import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  GOMOKU_BOARD_SIZE,
  applyMove,
  chooseComputerMove,
  deriveStatusFromMoves,
  detectForbiddenMove,
  isSamePosition,
  opponentOf,
  type ComputerLevel,
  type GameStatus,
  type GomokuMove,
  type Position,
  type RuleSet,
  type Stone,
} from './gomokuRules'
import './GomokuOverlay.css'

type GomokuOverlayProps = {
  open: boolean
  onClose: () => void
}

type GameMode = 'local' | 'computer'

const HUMAN_STONE: Stone = 'black'
const COMPUTER_STONE: Stone = 'white'
const DEFAULT_TIMER_SECONDS = 300
const COMPUTER_THINK_DELAY_MS = 420

const text = {
  title: '\uAD11\uC7A5 \uC624\uBAA9',
  subtitle: '\uBC14\uB451\uD310 \uC55E\uC5D0\uC11C \uBC14\uB85C \uD55C \uD310',
  close: '\uB2EB\uAE30',
  mode: '\uB300\uC804',
  local: '2\uC778',
  computer: '\uCEF4\uD4E8\uD130',
  computerLevel: '\uCEF4\uD4E8\uD130 \uB09C\uC774\uB3C4',
  beginner: '\uCD08\uAE09',
  intermediate: '\uC911\uAE09',
  advanced: '\uACE0\uAE09',
  rule: '\uB8F0',
  freestyle: '\uC790\uC720\uB8F0',
  renju: '\uAE08\uC218\uB8F0',
  timer: '\uD0C0\uC774\uBA38',
  timerOn: '\uCF1C\uAE30',
  timerOff: '\uB044\uAE30',
  restart: '\uC0C8 \uB300\uAD6D',
  undo: '\uBB34\uB974\uAE30',
  hint: '\uCD94\uCC9C\uC218',
  history: '\uAE30\uBCF4',
  black: '\uD751',
  white: '\uBC31',
  current: '\uCC28\uB840',
  wins: '\uC2B9',
  draws: '\uBB34',
  computerThinking: '\uCEF4\uD4E8\uD130\uAC00 \uC218\uB97C \uACC4\uC0B0\uD558\uB294 \uC911',
  forbidden: '\uAE08\uC218\uC785\uB2C8\uB2E4.',
  emptyHistory: '\uC544\uC9C1 \uB450\uC5B4\uC9C4 \uC218\uAC00 \uC5C6\uC5B4\uC694.',
  blackWins: '\uD751\uC758 \uC2B9\uB9AC',
  whiteWins: '\uBC31\uC758 \uC2B9\uB9AC',
  draw: '\uBB34\uC2B9\uBD80',
  playing: '\uB300\uAD6D \uC9C4\uD589 \uC911',
  timeout: '\uC2DC\uAC04\uC774 \uB05D\uB0AC\uC5B4\uC694.',
  five: '5\uBAA9\uC744 \uC644\uC131\uD588\uC5B4\uC694.',
} as const

const timerOptions = [
  { label: '3\uBD84', value: 180 },
  { label: '5\uBD84', value: 300 },
  { label: '10\uBD84', value: 600 },
] as const

const starPoints = new Set(['3:3', '3:11', '7:7', '11:3', '11:11'])

export function GomokuOverlay({ open, onClose }: GomokuOverlayProps) {
  const [mode, setMode] = useState<GameMode>('computer')
  const [computerLevel, setComputerLevel] = useState<ComputerLevel>('intermediate')
  const [ruleSet, setRuleSet] = useState<RuleSet>('renju-lite')
  const [timerEnabled, setTimerEnabled] = useState(true)
  const [timerSeconds, setTimerSeconds] = useState(DEFAULT_TIMER_SECONDS)
  const [moves, setMoves] = useState<GomokuMove[]>([])
  const [timers, setTimers] = useState<Record<Stone, number>>({
    black: DEFAULT_TIMER_SECONDS,
    white: DEFAULT_TIMER_SECONDS,
  })
  const [statusMessage, setStatusMessage] = useState('')
  const [timeoutWinner, setTimeoutWinner] = useState<Stone | null>(null)
  const [isComputerThinking, setIsComputerThinking] = useState(false)
  const [hintMove, setHintMove] = useState<Position | null>(null)
  const [scoreboard, setScoreboard] = useState({ black: 0, white: 0, draw: 0 })
  const recordedResultRef = useRef<string | null>(null)

  const { board, status } = useMemo(
    () => deriveStatusFromMoves(moves, ruleSet, GOMOKU_BOARD_SIZE),
    [moves, ruleSet],
  )
  const currentTurn: Stone = moves.length % 2 === 0 ? 'black' : 'white'
  const lastMove = moves.at(-1)?.position ?? null
  const effectiveStatus = useMemo(
    () => withTimeoutStatus(status, timeoutWinner),
    [status, timeoutWinner],
  )
  const canHumanPlay =
    effectiveStatus.phase === 'playing' && (mode === 'local' || currentTurn === HUMAN_STONE)

  const resetGame = useCallback(() => {
    setMoves([])
    setTimers({ black: timerSeconds, white: timerSeconds })
    setStatusMessage('')
    setTimeoutWinner(null)
    setHintMove(null)
    setIsComputerThinking(false)
    recordedResultRef.current = null
  }, [timerSeconds])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [onClose, open])

  useEffect(() => {
    if (!open || !timerEnabled || effectiveStatus.phase !== 'playing' || isComputerThinking) return

    const intervalId = window.setInterval(() => {
      setTimers(previous => {
        const nextValue = Math.max(0, previous[currentTurn] - 1)
        const nextTimers = { ...previous, [currentTurn]: nextValue }
        if (nextValue === 0) {
          setTimeoutWinner(opponentOf(currentTurn))
        }
        return nextTimers
      })
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [currentTurn, effectiveStatus.phase, isComputerThinking, open, timerEnabled])

  useEffect(() => {
    if (
      !open ||
      mode !== 'computer' ||
      currentTurn !== COMPUTER_STONE ||
      effectiveStatus.phase !== 'playing'
    ) {
      setIsComputerThinking(false)
      return
    }

    setIsComputerThinking(true)
    const timeoutId = window.setTimeout(() => {
      const nextMove = chooseComputerMove(board, computerLevel, COMPUTER_STONE, ruleSet)
      setMoves(previousMoves => {
        if (!nextMove || previousMoves.length !== moves.length) return previousMoves
        return [...previousMoves, { position: nextMove, stone: COMPUTER_STONE, source: 'computer' }]
      })
      setStatusMessage('')
      setHintMove(null)
      setIsComputerThinking(false)
    }, COMPUTER_THINK_DELAY_MS)

    return () => window.clearTimeout(timeoutId)
  }, [board, computerLevel, currentTurn, effectiveStatus.phase, mode, moves.length, open, ruleSet])

  useEffect(() => {
    if (effectiveStatus.phase === 'playing') {
      recordedResultRef.current = null
      return
    }

    const resultKey =
      effectiveStatus.phase === 'draw'
        ? `draw:${moves.length}`
        : `${effectiveStatus.winner}:${effectiveStatus.reason}:${moves.length}`
    if (recordedResultRef.current === resultKey) return

    recordedResultRef.current = resultKey
    setScoreboard(previous => {
      if (effectiveStatus.phase === 'draw') {
        return { ...previous, draw: previous.draw + 1 }
      }
      return { ...previous, [effectiveStatus.winner]: previous[effectiveStatus.winner] + 1 }
    })
  }, [effectiveStatus, moves.length])

  useEffect(() => {
    resetGame()
  }, [mode, ruleSet, timerSeconds, resetGame])

  if (!open) return null

  const handleCellClick = (position: Position) => {
    if (!canHumanPlay) return
    if (board[position.row][position.col]) return

    const forbidden = detectForbiddenMove(board, position, currentTurn, ruleSet)
    if (forbidden) {
      setStatusMessage(forbidden.message)
      return
    }

    try {
      applyMove(board, position, currentTurn)
    } catch {
      return
    }

    setMoves(previous => [...previous, { position, stone: currentTurn, source: 'human' }])
    setStatusMessage('')
    setHintMove(null)
  }

  const handleUndo = () => {
    setMoves(previous =>
      previous.slice(0, Math.max(0, previous.length - (mode === 'computer' ? 2 : 1))),
    )
    setStatusMessage('')
    setHintMove(null)
    setTimeoutWinner(null)
    recordedResultRef.current = null
  }

  const handleHint = () => {
    if (effectiveStatus.phase !== 'playing') return
    const move = chooseComputerMove(board, 'advanced', currentTurn, ruleSet)
    setHintMove(move)
    setStatusMessage(
      move
        ? `${formatMoveNumber(move)} ${text.hint}`
        : '\uCD94\uCC9C\uD560 \uC218\uAC00 \uC5C6\uC5B4\uC694.',
    )
  }

  return (
    <div className="gomoku-backdrop" role="dialog" aria-modal="true" aria-label={text.title}>
      <section className="gomoku-shell">
        <header className="gomoku-topbar">
          <div>
            <h1>{text.title}</h1>
            <p>{text.subtitle}</p>
          </div>
          <button type="button" className="gomoku-close-button" onClick={onClose}>
            {text.close}
          </button>
        </header>

        <main className="gomoku-layout">
          <section className="gomoku-board-zone" aria-label={text.title}>
            <StatusBanner
              status={effectiveStatus}
              currentTurn={currentTurn}
              isComputerThinking={isComputerThinking}
              message={statusMessage}
            />
            <div className="gomoku-board-wrap">
              <div className="gomoku-board" role="grid" aria-label="15 x 15 gomoku board">
                {board.map((row, rowIndex) =>
                  row.map((cell, colIndex) => {
                    const position = { row: rowIndex, col: colIndex }
                    const winning = effectiveStatus.winningLine?.some(linePosition =>
                      isSamePosition(linePosition, position),
                    )
                    const last = isSamePosition(lastMove, position)
                    const hinted = isSamePosition(hintMove, position)
                    const className = [
                      'gomoku-cell',
                      cell ? `stone-${cell}` : '',
                      winning ? 'winning' : '',
                      last ? 'last' : '',
                      hinted ? 'hinted' : '',
                      !cell && starPoints.has(`${rowIndex}:${colIndex}`) ? 'star' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')

                    return (
                      <button
                        key={`${rowIndex}:${colIndex}`}
                        type="button"
                        role="gridcell"
                        className={className}
                        aria-label={`${rowIndex + 1}, ${colIndex + 1}`}
                        disabled={!canHumanPlay || Boolean(cell)}
                        onClick={() => handleCellClick(position)}
                      >
                        {cell ? <span className="gomoku-stone" aria-hidden="true" /> : null}
                      </button>
                    )
                  }),
                )}
              </div>
            </div>
          </section>

          <aside className="gomoku-side">
            <ControlPanel
              mode={mode}
              computerLevel={computerLevel}
              ruleSet={ruleSet}
              timerEnabled={timerEnabled}
              timerSeconds={timerSeconds}
              onModeChange={setMode}
              onComputerLevelChange={setComputerLevel}
              onRuleSetChange={setRuleSet}
              onTimerEnabledChange={setTimerEnabled}
              onTimerSecondsChange={setTimerSeconds}
            />
            <MatchPanel
              currentTurn={currentTurn}
              timers={timers}
              scoreboard={scoreboard}
              timerEnabled={timerEnabled}
            />
            <div className="gomoku-actions" aria-label="\uB300\uAD6D \uBA85\uB839">
              <button type="button" onClick={resetGame}>
                {text.restart}
              </button>
              <button type="button" onClick={handleUndo} disabled={moves.length === 0}>
                {text.undo}
              </button>
              <button
                type="button"
                onClick={handleHint}
                disabled={effectiveStatus.phase !== 'playing'}
              >
                {text.hint}
              </button>
            </div>
            <MoveHistory moves={moves} />
          </aside>
        </main>
      </section>
    </div>
  )
}

function ControlPanel({
  mode,
  computerLevel,
  ruleSet,
  timerEnabled,
  timerSeconds,
  onModeChange,
  onComputerLevelChange,
  onRuleSetChange,
  onTimerEnabledChange,
  onTimerSecondsChange,
}: {
  mode: GameMode
  computerLevel: ComputerLevel
  ruleSet: RuleSet
  timerEnabled: boolean
  timerSeconds: number
  onModeChange: (mode: GameMode) => void
  onComputerLevelChange: (level: ComputerLevel) => void
  onRuleSetChange: (ruleSet: RuleSet) => void
  onTimerEnabledChange: (enabled: boolean) => void
  onTimerSecondsChange: (seconds: number) => void
}) {
  return (
    <section className="gomoku-panel">
      <div className="gomoku-control-group">
        <span>{text.mode}</span>
        <div className="gomoku-segmented">
          <button
            type="button"
            className={mode === 'computer' ? 'active' : ''}
            onClick={() => onModeChange('computer')}
          >
            {text.computer}
          </button>
          <button
            type="button"
            className={mode === 'local' ? 'active' : ''}
            onClick={() => onModeChange('local')}
          >
            {text.local}
          </button>
        </div>
      </div>

      <div className="gomoku-control-group">
        <span>{text.computerLevel}</span>
        <div className="gomoku-segmented">
          {(['beginner', 'intermediate', 'advanced'] as const).map(level => (
            <button
              key={level}
              type="button"
              className={computerLevel === level ? 'active' : ''}
              disabled={mode !== 'computer'}
              onClick={() => onComputerLevelChange(level)}
            >
              {level === 'beginner'
                ? text.beginner
                : level === 'intermediate'
                  ? text.intermediate
                  : text.advanced}
            </button>
          ))}
        </div>
      </div>

      <div className="gomoku-control-group">
        <span>{text.rule}</span>
        <div className="gomoku-segmented">
          <button
            type="button"
            className={ruleSet === 'renju-lite' ? 'active' : ''}
            onClick={() => onRuleSetChange('renju-lite')}
          >
            {text.renju}
          </button>
          <button
            type="button"
            className={ruleSet === 'freestyle' ? 'active' : ''}
            onClick={() => onRuleSetChange('freestyle')}
          >
            {text.freestyle}
          </button>
        </div>
      </div>

      <div className="gomoku-control-group">
        <span>{text.timer}</span>
        <div className="gomoku-segmented">
          <button
            type="button"
            className={timerEnabled ? 'active' : ''}
            onClick={() => onTimerEnabledChange(true)}
          >
            {text.timerOn}
          </button>
          <button
            type="button"
            className={!timerEnabled ? 'active' : ''}
            onClick={() => onTimerEnabledChange(false)}
          >
            {text.timerOff}
          </button>
        </div>
      </div>

      <div className="gomoku-timer-options">
        {timerOptions.map(option => (
          <button
            key={option.value}
            type="button"
            className={timerSeconds === option.value ? 'active' : ''}
            disabled={!timerEnabled}
            onClick={() => onTimerSecondsChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  )
}

function MatchPanel({
  currentTurn,
  timers,
  scoreboard,
  timerEnabled,
}: {
  currentTurn: Stone
  timers: Record<Stone, number>
  scoreboard: Record<Stone, number> & { draw: number }
  timerEnabled: boolean
}) {
  return (
    <section className="gomoku-panel gomoku-match-panel">
      <div className="gomoku-player-row active">
        <span className="gomoku-player-dot black" />
        <span>{text.black}</span>
        <strong>
          {scoreboard.black}
          {text.wins}
        </strong>
        <time>{timerEnabled ? formatTime(timers.black) : '--:--'}</time>
      </div>
      <div className="gomoku-player-row">
        <span className="gomoku-player-dot white" />
        <span>{text.white}</span>
        <strong>
          {scoreboard.white}
          {text.wins}
        </strong>
        <time>{timerEnabled ? formatTime(timers.white) : '--:--'}</time>
      </div>
      <div className="gomoku-current-turn">
        {text.current}: {currentTurn === 'black' ? text.black : text.white}
        <span>
          {scoreboard.draw}
          {text.draw}
        </span>
      </div>
    </section>
  )
}

function StatusBanner({
  status,
  currentTurn,
  isComputerThinking,
  message,
}: {
  status: GameStatus
  currentTurn: Stone
  isComputerThinking: boolean
  message: string
}) {
  let headline: string = text.playing
  let detail: string = currentTurn === 'black' ? text.black : text.white

  if (isComputerThinking) {
    detail = text.computerThinking
  }

  if (status.phase === 'won') {
    headline = status.winner === 'black' ? text.blackWins : text.whiteWins
    detail = status.reason === 'timeout' ? text.timeout : text.five
  }

  if (status.phase === 'draw') {
    headline = text.draw
    detail = '\uBC14\uB451\uD310\uC774 \uAC00\uB4DD \uCC3C\uC5B4\uC694.'
  }

  return (
    <div className="gomoku-status">
      <strong>{headline}</strong>
      <span>{message || detail}</span>
    </div>
  )
}

function MoveHistory({ moves }: { moves: GomokuMove[] }) {
  return (
    <section className="gomoku-panel gomoku-history">
      <h2>{text.history}</h2>
      {moves.length === 0 ? (
        <p>{text.emptyHistory}</p>
      ) : (
        <ol>
          {moves.map((move, index) => (
            <li key={`${move.position.row}:${move.position.col}:${index}`}>
              <span>{index + 1}</span>
              <strong>{move.stone === 'black' ? text.black : text.white}</strong>
              <em>{formatMoveNumber(move.position)}</em>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function withTimeoutStatus(status: GameStatus, timeoutWinner: Stone | null): GameStatus {
  if (!timeoutWinner || status.phase !== 'playing') return status
  return {
    phase: 'won',
    winner: timeoutWinner,
    winningLine: [],
    reason: 'timeout',
  }
}

function formatMoveNumber(position: Position) {
  return `${String.fromCharCode(65 + position.col)}${position.row + 1}`
}

function formatTime(seconds: number) {
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}
