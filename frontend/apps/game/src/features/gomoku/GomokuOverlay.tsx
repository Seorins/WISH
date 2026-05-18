import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createGomokuRoom,
  getGomokuRanking,
  getGomokuRoom,
  getMyGomokuStats,
  getWaitingGomokuRooms,
  joinGomokuRoom,
  leaveGomokuRoom,
  playGomokuMove,
  resignGomokuRoom,
  type GomokuEndReason,
  type GomokuRanking,
  type GomokuRoom,
  type GomokuRuleSet as ApiGomokuRuleSet,
  type GomokuStats,
  type GomokuStone as ApiGomokuStone,
} from '@wish/api-client'
import { assetPath } from '@/game/assets/assetPath'
import { hasValidAuthToken } from '../auth'
import { resolvePatientProfileIdOrFetch } from '../exerciseSessions/patientProfile'
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
  patientProfileId?: number
  onAuthRequired?: () => void
}

type GameMode = 'local' | 'computer' | 'online'
type OnlinePanelTab = 'rooms' | 'stats' | 'ranking'

const HUMAN_STONE: Stone = 'black'
const COMPUTER_STONE: Stone = 'white'
const DEFAULT_TIMER_SECONDS = 300
const COMPUTER_THINK_DELAY_MS = 420
const ONLINE_POLL_INTERVAL_MS = 1500
const DEMO_AUTH_ENABLED = import.meta.env.VITE_ENABLE_DEMO_AUTH === 'true'

const text = {
  title: '\uAD11\uC7A5 \uC624\uBAA9',
  subtitle: '\uBC14\uB451\uD310 \uC55E\uC5D0\uC11C \uBC14\uB85C \uD55C \uD310',
  close: '\uB2EB\uAE30',
  mode: '\uB300\uC804',
  local: '2\uC778',
  computer: '\uCEF4\uD4E8\uD130',
  online: '\uC628\uB77C\uC778',
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
  losses: '\uD328',
  winRate: '\uC2B9\uB960',
  totalGames: '\uC804\uC801',
  computerThinking: '\uCEF4\uD4E8\uD130\uAC00 \uC218\uB97C \uACC4\uC0B0\uD558\uB294 \uC911',
  forbidden: '\uAE08\uC218\uC785\uB2C8\uB2E4.',
  emptyHistory: '\uC544\uC9C1 \uB450\uC5B4\uC9C4 \uC218\uAC00 \uC5C6\uC5B4\uC694.',
  blackWins: '\uD751\uC758 \uC2B9\uB9AC',
  whiteWins: '\uBC31\uC758 \uC2B9\uB9AC',
  draw: '\uBB34\uC2B9\uBD80',
  playing: '\uB300\uAD6D \uC9C4\uD589 \uC911',
  timeout: '\uC2DC\uAC04\uC774 \uB05D\uB0AC\uC5B4\uC694.',
  five: '5\uBAA9\uC744 \uC644\uC131\uD588\uC5B4\uC694.',
  lobby: '\uB85C\uBE44',
  createRoom: '\uBC29 \uB9CC\uB4E4\uAE30',
  refresh: '\uC0C8\uB85C\uACE0\uCE68',
  join: '\uC785\uC7A5',
  leaveRoom: '\uBC29 \uB098\uAC00\uAE30',
  resign: '\uAE30\uAD8C',
  waitingRooms: '\uB300\uAE30 \uC911\uC778 \uBC29',
  waiting: '\uB300\uAE30',
  waitingOpponent: '\uC0C1\uB300\uB97C \uAE30\uB2E4\uB9AC\uB294 \uC911',
  noRooms: '\uC785\uC7A5\uD560 \uBC29\uC774 \uC5C6\uC5B4\uC694.',
  roomCode: '\uBC29 \uCF54\uB4DC',
  myStats: '\uB0B4 \uC804\uC801',
  ranking: '\uB7AD\uD0B9',
  onlineOnlyRanked:
    '\uC628\uB77C\uC778 \uB300\uAD6D\uB9CC \uB7AD\uD0B9\uC5D0 \uBC18\uC601\uB3FC\uC694.',
  onlineLoadingFailed:
    '\uC628\uB77C\uC778 \uC815\uBCF4\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC5B4\uC694.',
  onlineActionFailed: '\uC694\uCCAD\uC744 \uCC98\uB9AC\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694.',
  onlinePreparing:
    '\uC628\uB77C\uC778 \uB300\uC804\uC744 \uC900\uBE44\uD558\uB294 \uC911\uC774\uC5D0\uC694.',
  onlineAuthRequired:
    '\uC628\uB77C\uC778 \uB300\uC804\uC740 \uB85C\uADF8\uC778\uC774 \uD544\uC694\uD574\uC694.',
  onlineProfileRequired:
    '\uC628\uB77C\uC778 \uB300\uC804\uC744 \uD558\uB824\uBA74 \uD658\uC790 \uD504\uB85C\uD544\uC774 \uD544\uC694\uD574\uC694.',
  cancelled: '\uBC29\uC774 \uB2EB\uD614\uC5B4\uC694.',
  resigned: '\uAE30\uAD8C\uC73C\uB85C \uB300\uAD6D\uC774 \uB05D\uB0AC\uC5B4\uC694.',
  left: '\uC0C1\uB300\uAC00 \uB098\uAC14\uC5B4\uC694.',
  myTurn: '\uB0B4 \uCC28\uB840',
  opponentTurn: '\uC0C1\uB300 \uCC28\uB840',
  ranked: '\uB7AD\uD0B9 \uBC18\uC601',
  emptyRanking: '\uC544\uC9C1 \uB7AD\uD0B9\uC774 \uC5C6\uC5B4\uC694.',
  finishedRoomNextGame:
    '\uB300\uAD6D\uC774 \uB05D\uB0AC\uC5B4\uC694. \uB2E4\uC74C \uB300\uAD6D \uC900\uBE44 \uC644\uB8CC.',
  onlineMatch: '\uC628\uB77C\uC778 \uB300\uC804',
  onlineLobbyGuide: '\uC628\uB77C\uC778 \uB85C\uBE44 \uC900\uBE44 \uC644\uB8CC',
  gameStart: '\uB300\uAD6D \uC2DC\uC791',
  onlineGameStart: '\uC628\uB77C\uC778 \uB300\uAD6D \uC2DC\uC791',
  gameEnd: '\uB300\uAD6D \uC885\uB8CC',
  finished: '\uC885\uB8CC',
  me: '\uB098',
  opponent: '\uC0C1\uB300',
  versus: 'VS',
} as const

const timerOptions = [
  { label: '3\uBD84', value: 180 },
  { label: '5\uBD84', value: 300 },
  { label: '10\uBD84', value: 600 },
] as const

const starPoints = new Set(['3:3', '3:11', '7:7', '11:3', '11:11'])
const onlineCharacterImages = [
  assetPath('images/village/background/character/sehyun.png'),
  assetPath('images/village/background/character/joeun.png'),
  assetPath('images/village/background/character/geonbin.png'),
  assetPath('images/village/background/character/dain.png'),
  assetPath('images/village/background/character/komonge.png'),
  assetPath('images/village/background/character/jungho.png'),
] as const

export function GomokuOverlay({
  open,
  onClose,
  patientProfileId,
  onAuthRequired,
}: GomokuOverlayProps) {
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
  const [onlineRoom, setOnlineRoom] = useState<GomokuRoom | null>(null)
  const [waitingRooms, setWaitingRooms] = useState<GomokuRoom[]>([])
  const [onlineStats, setOnlineStats] = useState<GomokuStats | null>(null)
  const [onlineRanking, setOnlineRanking] = useState<GomokuRanking | null>(null)
  const [onlineBusy, setOnlineBusy] = useState(false)
  const [onlineError, setOnlineError] = useState('')
  const [resolvedPatientProfileId, setResolvedPatientProfileId] = useState<number | undefined>()
  const [isResolvingOnlineProfile, setIsResolvingOnlineProfile] = useState(false)
  const [onlineTick, setOnlineTick] = useState(() => Date.now())
  const recordedResultRef = useRef<string | null>(null)
  const syncedOnlineResultRef = useRef<number | null>(null)

  const effectivePatientProfileId = isValidPatientProfileId(patientProfileId)
    ? patientProfileId
    : resolvedPatientProfileId
  const hasOnlinePatientProfile = isValidPatientProfileId(effectivePatientProfileId)

  const onlineMoves = useMemo(() => onlineRoom?.moves.map(toLocalMove) ?? [], [onlineRoom])
  const activeMoves = mode === 'online' ? onlineMoves : moves
  const activeRuleSet =
    mode === 'online' && onlineRoom ? fromApiRuleSet(onlineRoom.ruleSet) : ruleSet

  const { board, status } = useMemo(
    () => deriveStatusFromMoves(activeMoves, activeRuleSet, GOMOKU_BOARD_SIZE),
    [activeMoves, activeRuleSet],
  )
  const currentTurn: Stone =
    mode === 'online'
      ? onlineRoom
        ? fromApiStone(onlineRoom.currentTurn)
        : 'black'
      : moves.length % 2 === 0
        ? 'black'
        : 'white'
  const lastMove = activeMoves.at(-1)?.position ?? null
  const onlineGameStatus = useMemo(
    () => (onlineRoom ? getOnlineGameStatus(onlineRoom, status) : null),
    [onlineRoom, status],
  )
  const effectiveStatus = useMemo(
    () => onlineGameStatus ?? withTimeoutStatus(status, timeoutWinner),
    [onlineGameStatus, status, timeoutWinner],
  )
  const onlineRoomId = onlineRoom?.id ?? null
  const onlineRoomStatus = onlineRoom?.status ?? null
  const myOnlineStone = onlineRoom?.myStone ? fromApiStone(onlineRoom.myStone) : null
  const onlineStatusMessage = onlineRoom
    ? getOnlineStatusMessage(onlineRoom, myOnlineStone, currentTurn)
    : ''
  const onlineProfileNotice = hasOnlinePatientProfile
    ? ''
    : isResolvingOnlineProfile
      ? text.onlinePreparing
      : getOnlineRequirementMessage()
  const canHumanPlay =
    mode === 'online'
      ? Boolean(
          onlineRoom &&
          onlineRoom.status === 'PLAYING' &&
          myOnlineStone === currentTurn &&
          effectiveStatus.phase === 'playing',
        )
      : effectiveStatus.phase === 'playing' && (mode === 'local' || currentTurn === HUMAN_STONE)
  const onlineTimers = useMemo(
    () =>
      onlineRoom
        ? calculateOnlineTimers(onlineRoom, onlineTick || Date.now())
        : { black: timerSeconds, white: timerSeconds },
    [onlineRoom, onlineTick, timerSeconds],
  )

  const resetGame = useCallback(() => {
    setMoves([])
    setTimers({ black: timerSeconds, white: timerSeconds })
    setStatusMessage('')
    setTimeoutWinner(null)
    setHintMove(null)
    setIsComputerThinking(false)
    recordedResultRef.current = null
  }, [timerSeconds])

  const loadOnlineDashboard = useCallback(async () => {
    try {
      const [roomsResponse, statsResponse, rankingResponse] = await Promise.all([
        getWaitingGomokuRooms({ size: 12 }),
        getMyGomokuStats(),
        getGomokuRanking(10, 1),
      ])
      setWaitingRooms(roomsResponse.data?.content ?? [])
      setOnlineStats(statsResponse.data ?? null)
      setOnlineRanking(rankingResponse.data ?? null)
      setOnlineError('')
    } catch (error) {
      setOnlineError(getApiErrorMessage(error, text.onlineLoadingFailed))
    }
  }, [])

  const refreshOnlineRoom = useCallback(async (roomId: number) => {
    try {
      const response = await getGomokuRoom(roomId)
      if (!response.data) {
        throw new Error(text.onlineLoadingFailed)
      }
      const roomPatientProfileId = getMyPatientProfileIdFromRoom(response.data)
      if (roomPatientProfileId) {
        setResolvedPatientProfileId(roomPatientProfileId)
      }
      setOnlineRoom(response.data)
      setOnlineError('')
    } catch (error) {
      setOnlineError(getApiErrorMessage(error, text.onlineLoadingFailed))
    }
  }, [])

  const handleModeChange = useCallback((nextMode: GameMode) => {
    setMode(nextMode)
    if (nextMode === 'online') {
      setTimerEnabled(true)
    }
  }, [])

  const ensureOnlinePatientProfile = useCallback(async () => {
    if (hasOnlinePatientProfile) return true

    setIsResolvingOnlineProfile(true)
    try {
      const resolvedId = await resolvePatientProfileIdOrFetch()
      if (isValidPatientProfileId(resolvedId)) {
        setResolvedPatientProfileId(resolvedId)
        setOnlineError('')
        return true
      }

      if (DEMO_AUTH_ENABLED && !hasValidAuthToken()) {
        return true
      }

      const message = getOnlineRequirementMessage()
      setOnlineError(message)
      if (!hasValidAuthToken()) {
        onAuthRequired?.()
      }
      return false
    } finally {
      setIsResolvingOnlineProfile(false)
    }
  }, [hasOnlinePatientProfile, onAuthRequired])

  const handleOnlineCreate = useCallback(async () => {
    setOnlineBusy(true)
    try {
      if (!(await ensureOnlinePatientProfile())) return
      const response = await createGomokuRoom({
        ruleSet: toApiRuleSet(ruleSet),
        timerSeconds,
      })
      if (!response.data) {
        throw new Error(text.onlineActionFailed)
      }
      const roomPatientProfileId = getMyPatientProfileIdFromRoom(response.data)
      if (roomPatientProfileId) {
        setResolvedPatientProfileId(roomPatientProfileId)
      }
      setOnlineRoom(response.data)
      setOnlineError('')
      await loadOnlineDashboard()
    } catch (error) {
      setOnlineError(getApiErrorMessage(error, text.onlineActionFailed))
    } finally {
      setOnlineBusy(false)
    }
  }, [ensureOnlinePatientProfile, loadOnlineDashboard, ruleSet, timerSeconds])

  const handleOnlineRefresh = useCallback(async () => {
    setOnlineBusy(true)
    try {
      if (!(await ensureOnlinePatientProfile())) return
      await loadOnlineDashboard()
      if (onlineRoomId) {
        await refreshOnlineRoom(onlineRoomId)
      }
    } finally {
      setOnlineBusy(false)
    }
  }, [ensureOnlinePatientProfile, loadOnlineDashboard, onlineRoomId, refreshOnlineRoom])

  const handleOnlineJoin = useCallback(
    async (roomId: number) => {
      setOnlineBusy(true)
      try {
        if (!(await ensureOnlinePatientProfile())) return
        const response = await joinGomokuRoom(roomId)
        if (!response.data) {
          throw new Error(text.onlineActionFailed)
        }
        const roomPatientProfileId = getMyPatientProfileIdFromRoom(response.data)
        if (roomPatientProfileId) {
          setResolvedPatientProfileId(roomPatientProfileId)
        }
        setOnlineRoom(response.data)
        setOnlineError('')
        await loadOnlineDashboard()
      } catch (error) {
        setOnlineError(getApiErrorMessage(error, text.onlineActionFailed))
      } finally {
        setOnlineBusy(false)
      }
    },
    [ensureOnlinePatientProfile, loadOnlineDashboard],
  )

  const handleOnlineResign = useCallback(async () => {
    if (!onlineRoomId) return
    setOnlineBusy(true)
    try {
      const response = await resignGomokuRoom(onlineRoomId)
      if (!response.data) {
        throw new Error(text.onlineActionFailed)
      }
      setOnlineRoom(response.data)
      setOnlineError('')
      await loadOnlineDashboard()
    } catch (error) {
      setOnlineError(getApiErrorMessage(error, text.onlineActionFailed))
    } finally {
      setOnlineBusy(false)
    }
  }, [loadOnlineDashboard, onlineRoomId])

  const handleOnlineLeave = useCallback(async () => {
    if (!onlineRoomId) return
    if (onlineRoom?.status === 'FINISHED' || onlineRoom?.status === 'CANCELLED') {
      setOnlineRoom(null)
      await loadOnlineDashboard()
      return
    }

    setOnlineBusy(true)
    try {
      const response = await leaveGomokuRoom(onlineRoomId)
      if (!response.data) {
        throw new Error(text.onlineActionFailed)
      }
      setOnlineRoom(response.data)
      setOnlineError('')
      await loadOnlineDashboard()
    } catch (error) {
      setOnlineError(getApiErrorMessage(error, text.onlineActionFailed))
    } finally {
      setOnlineBusy(false)
    }
  }, [loadOnlineDashboard, onlineRoom, onlineRoomId])

  const handleOnlineCellClick = useCallback(
    async (position: Position) => {
      if (!onlineRoomId || !canHumanPlay) return
      if (board[position.row][position.col]) return

      const forbidden = detectForbiddenMove(board, position, currentTurn, activeRuleSet)
      if (forbidden) {
        setOnlineError(forbidden.message)
        return
      }

      setOnlineBusy(true)
      try {
        const response = await playGomokuMove(onlineRoomId, position)
        if (!response.data) {
          throw new Error(text.onlineActionFailed)
        }
        setOnlineRoom(response.data)
        setOnlineError('')
        if (response.data.status === 'FINISHED') {
          await loadOnlineDashboard()
        }
      } catch (error) {
        setOnlineError(getApiErrorMessage(error, text.onlineActionFailed))
      } finally {
        setOnlineBusy(false)
      }
    },
    [activeRuleSet, board, canHumanPlay, currentTurn, loadOnlineDashboard, onlineRoomId],
  )

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
    if (
      !open ||
      mode === 'online' ||
      !timerEnabled ||
      effectiveStatus.phase !== 'playing' ||
      isComputerThinking
    ) {
      return
    }

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
  }, [currentTurn, effectiveStatus.phase, isComputerThinking, mode, open, timerEnabled])

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
    if (mode === 'online') return

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
  }, [effectiveStatus, mode, moves.length])

  useEffect(() => {
    if (mode !== 'online') {
      resetGame()
    }
  }, [mode, resetGame, ruleSet, timerSeconds])

  useEffect(() => {
    if (!open || mode !== 'online' || !hasOnlinePatientProfile) return
    void loadOnlineDashboard()
  }, [hasOnlinePatientProfile, loadOnlineDashboard, mode, open])

  useEffect(() => {
    if (!open) {
      setResolvedPatientProfileId(undefined)
      setIsResolvingOnlineProfile(false)
      return
    }

    if (mode !== 'online' || hasOnlinePatientProfile) {
      setIsResolvingOnlineProfile(false)
      return
    }

    let isCancelled = false
    setIsResolvingOnlineProfile(true)

    void resolvePatientProfileIdOrFetch()
      .then(resolvedId => {
        if (isCancelled) return
        if (isValidPatientProfileId(resolvedId)) {
          setResolvedPatientProfileId(resolvedId)
          setOnlineError('')
          return
        }
        if (!(DEMO_AUTH_ENABLED && !hasValidAuthToken())) {
          setOnlineError(getOnlineRequirementMessage())
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsResolvingOnlineProfile(false)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [hasOnlinePatientProfile, mode, open])

  useEffect(() => {
    if (
      !open ||
      mode !== 'online' ||
      onlineRoomId === null ||
      (onlineRoomStatus !== 'WAITING' && onlineRoomStatus !== 'PLAYING')
    ) {
      return
    }

    const intervalId = window.setInterval(() => {
      void refreshOnlineRoom(onlineRoomId)
    }, ONLINE_POLL_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [mode, onlineRoomId, onlineRoomStatus, open, refreshOnlineRoom])

  useEffect(() => {
    if (!open || mode !== 'online' || onlineRoomStatus !== 'PLAYING') return
    setOnlineTick(Date.now())
    const intervalId = window.setInterval(() => setOnlineTick(Date.now()), 1000)
    return () => window.clearInterval(intervalId)
  }, [mode, onlineRoomStatus, open])

  useEffect(() => {
    if (
      mode !== 'online' ||
      onlineRoomId === null ||
      (onlineRoomStatus !== 'FINISHED' && onlineRoomStatus !== 'CANCELLED') ||
      syncedOnlineResultRef.current === onlineRoomId
    ) {
      return
    }
    syncedOnlineResultRef.current = onlineRoomId
    void loadOnlineDashboard()
  }, [loadOnlineDashboard, mode, onlineRoomId, onlineRoomStatus])

  if (!open) return null

  const handleCellClick = (position: Position) => {
    if (mode === 'online') {
      void handleOnlineCellClick(position)
      return
    }

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
    if (mode === 'online') return
    setMoves(previous =>
      previous.slice(0, Math.max(0, previous.length - (mode === 'computer' ? 2 : 1))),
    )
    setStatusMessage('')
    setHintMove(null)
    setTimeoutWinner(null)
    recordedResultRef.current = null
  }

  const handleHint = () => {
    if (mode === 'online' || effectiveStatus.phase !== 'playing') return
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
      <section className={`gomoku-shell ${mode === 'online' ? 'online' : ''}`}>
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
              isComputerThinking={mode === 'computer' && isComputerThinking}
              mode={mode}
              room={onlineRoom}
              myOnlineStone={myOnlineStone}
              moveCount={activeMoves.length}
              message={
                mode === 'online'
                  ? onlineError ||
                    (isResolvingOnlineProfile ? text.onlinePreparing : onlineStatusMessage)
                  : statusMessage
              }
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
                    const hinted = mode !== 'online' && isSamePosition(hintMove, position)
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
                        style={{
                          left: `${(colIndex / (GOMOKU_BOARD_SIZE - 1)) * 100}%`,
                          top: `${(rowIndex / (GOMOKU_BOARD_SIZE - 1)) * 100}%`,
                        }}
                        className={className}
                        aria-label={`${rowIndex + 1}, ${colIndex + 1}`}
                        disabled={
                          !canHumanPlay || Boolean(cell) || (mode === 'online' && onlineBusy)
                        }
                        onClick={() => handleCellClick(position)}
                      >
                        {cell ? <span className="gomoku-stone" aria-hidden="true" /> : null}
                      </button>
                    )
                  }),
                )}
              </div>
              <BoardPhaseOverlay
                status={effectiveStatus}
                mode={mode}
                room={onlineRoom}
                currentTurn={currentTurn}
                myOnlineStone={myOnlineStone}
                moveCount={activeMoves.length}
                message={mode === 'online' ? onlineStatusMessage : statusMessage}
              />
            </div>
          </section>

          <aside className="gomoku-side">
            <ControlPanel
              mode={mode}
              computerLevel={computerLevel}
              ruleSet={ruleSet}
              timerEnabled={timerEnabled}
              timerSeconds={timerSeconds}
              onModeChange={handleModeChange}
              onComputerLevelChange={setComputerLevel}
              onRuleSetChange={setRuleSet}
              onTimerEnabledChange={setTimerEnabled}
              onTimerSecondsChange={setTimerSeconds}
            />
            {mode === 'online' ? (
              <OnlineVersusPanel
                room={onlineRoom}
                currentTurn={currentTurn}
                myOnlineStone={myOnlineStone}
              />
            ) : null}
            <MatchPanel
              currentTurn={currentTurn}
              timers={mode === 'online' ? onlineTimers : timers}
              scoreboard={mode === 'online' ? null : scoreboard}
              timerEnabled={mode === 'online' || timerEnabled}
              blackName={mode === 'online' ? onlineRoom?.blackPlayer.nickname : undefined}
              whiteName={
                mode === 'online' ? (onlineRoom?.whitePlayer?.nickname ?? text.waiting) : undefined
              }
            />
            {mode === 'online' ? (
              <OnlinePanel
                room={onlineRoom}
                waitingRooms={waitingRooms}
                stats={onlineStats}
                ranking={onlineRanking}
                busy={onlineBusy}
                profileNotice={onlineProfileNotice}
                onCreateRoom={handleOnlineCreate}
                onRefreshRooms={handleOnlineRefresh}
                onJoinRoom={handleOnlineJoin}
              />
            ) : null}
            {mode === 'online' ? (
              <div className="gomoku-actions" aria-label="\uB300\uAD6D \uBA85\uB839">
                <button type="button" onClick={handleOnlineRefresh} disabled={onlineBusy}>
                  {text.refresh}
                </button>
                <button
                  type="button"
                  onClick={handleOnlineResign}
                  disabled={!onlineRoom || onlineRoom.status !== 'PLAYING' || onlineBusy}
                >
                  {text.resign}
                </button>
                <button
                  type="button"
                  onClick={handleOnlineLeave}
                  disabled={!onlineRoom || onlineBusy}
                >
                  {text.leaveRoom}
                </button>
              </div>
            ) : (
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
            )}
            <MoveHistory moves={activeMoves} />
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
          <button
            type="button"
            className={mode === 'online' ? 'active' : ''}
            onClick={() => onModeChange('online')}
          >
            {text.online}
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
            disabled={mode === 'online'}
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
  blackName,
  whiteName,
}: {
  currentTurn: Stone
  timers: Record<Stone, number>
  scoreboard: (Record<Stone, number> & { draw: number }) | null
  timerEnabled: boolean
  blackName?: string
  whiteName?: string
}) {
  return (
    <section className="gomoku-panel gomoku-match-panel">
      <div className={`gomoku-player-row ${currentTurn === 'black' ? 'active' : ''}`}>
        <span className="gomoku-player-dot black" />
        <span>{blackName ?? text.black}</span>
        <strong>
          {scoreboard
            ? `${scoreboard.black}${text.wins}`
            : currentTurn === 'black'
              ? text.current
              : ''}
        </strong>
        <time>{timerEnabled ? formatTime(timers.black) : '--:--'}</time>
      </div>
      <div className={`gomoku-player-row ${currentTurn === 'white' ? 'active' : ''}`}>
        <span className="gomoku-player-dot white" />
        <span>{whiteName ?? text.white}</span>
        <strong>
          {scoreboard
            ? `${scoreboard.white}${text.wins}`
            : currentTurn === 'white'
              ? text.current
              : ''}
        </strong>
        <time>{timerEnabled ? formatTime(timers.white) : '--:--'}</time>
      </div>
      <div className="gomoku-current-turn">
        {text.current}: {currentTurn === 'black' ? text.black : text.white}
        <span>{scoreboard ? `${scoreboard.draw}${text.draw}` : ''}</span>
      </div>
    </section>
  )
}

function OnlinePanel({
  room,
  waitingRooms,
  stats,
  ranking,
  busy,
  onCreateRoom,
  onRefreshRooms,
  onJoinRoom,
  profileNotice,
}: {
  room: GomokuRoom | null
  waitingRooms: GomokuRoom[]
  stats: GomokuStats | null
  ranking: GomokuRanking | null
  busy: boolean
  profileNotice: string
  onCreateRoom: () => void
  onRefreshRooms: () => void
  onJoinRoom: (roomId: number) => void
}) {
  const [activeTab, setActiveTab] = useState<OnlinePanelTab>('rooms')
  const canChooseNextRoom = !room || isClosedOnlineRoom(room)

  return (
    <section className="gomoku-panel gomoku-online-panel">
      <div className="gomoku-panel-heading">
        <h2>{text.online}</h2>
        <span>{text.onlineOnlyRanked}</span>
      </div>

      {room ? (
        <div className="gomoku-current-room">
          <div>
            <span>{text.roomCode}</span>
            <strong>{room.roomCode}</strong>
          </div>
          <em>{formatRoomStatus(room)}</em>
        </div>
      ) : null}

      <div className="gomoku-online-tabs" role="tablist" aria-label={text.online}>
        <button
          type="button"
          className={activeTab === 'rooms' ? 'active' : ''}
          aria-pressed={activeTab === 'rooms'}
          onClick={() => setActiveTab('rooms')}
        >
          {text.lobby}
        </button>
        <button
          type="button"
          className={activeTab === 'stats' ? 'active' : ''}
          aria-pressed={activeTab === 'stats'}
          onClick={() => setActiveTab('stats')}
        >
          {text.myStats}
        </button>
        <button
          type="button"
          className={activeTab === 'ranking' ? 'active' : ''}
          aria-pressed={activeTab === 'ranking'}
          onClick={() => setActiveTab('ranking')}
        >
          {text.ranking}
        </button>
      </div>

      <div className="gomoku-online-tab-panel">
        {activeTab === 'rooms' ? (
          !canChooseNextRoom && room ? (
            <p className="gomoku-online-message">
              {room.status === 'WAITING' ? text.waitingOpponent : formatRoomStatus(room)}
            </p>
          ) : (
            <>
              {room ? <p className="gomoku-online-message">{text.finishedRoomNextGame}</p> : null}
              <div className="gomoku-online-actions">
                <button type="button" onClick={onCreateRoom} disabled={busy}>
                  {text.createRoom}
                </button>
                <button type="button" onClick={onRefreshRooms} disabled={busy}>
                  {text.refresh}
                </button>
              </div>
              {profileNotice ? <p className="gomoku-online-message">{profileNotice}</p> : null}

              <div className="gomoku-room-list" aria-label={text.waitingRooms}>
                <h3>{text.waitingRooms}</h3>
                {waitingRooms.length === 0 ? (
                  <p>{text.noRooms}</p>
                ) : (
                  waitingRooms.map(waitingRoom => (
                    <div className="gomoku-room-row" key={waitingRoom.id}>
                      <div>
                        <strong>{waitingRoom.blackPlayer.nickname}</strong>
                        <span>
                          {waitingRoom.roomCode} ·{' '}
                          {formatRuleSet(fromApiRuleSet(waitingRoom.ruleSet))}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onJoinRoom(waitingRoom.id)}
                        disabled={busy}
                      >
                        {text.join}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          )
        ) : null}

        {activeTab === 'stats' ? (
          <div className="gomoku-stats-grid">
            <div>
              <span>{text.totalGames}</span>
              <strong>{stats?.totalGames ?? 0}</strong>
            </div>
            <div>
              <span>{text.wins}</span>
              <strong>{stats?.wins ?? 0}</strong>
            </div>
            <div>
              <span>{text.draws}</span>
              <strong>{stats?.draws ?? 0}</strong>
            </div>
            <div>
              <span>{text.losses}</span>
              <strong>{stats?.losses ?? 0}</strong>
            </div>
            <div>
              <span>{text.winRate}</span>
              <strong>{formatPercent(stats?.winRate ?? 0)}</strong>
            </div>
          </div>
        ) : null}

        {activeTab === 'ranking' ? (
          <div className="gomoku-ranking">
            <h3>{text.ranking}</h3>
            {ranking && ranking.entries.length > 0 ? (
              <ol>
                {ranking.entries.map(entry => (
                  <li key={entry.patientProfileId} className={entry.isMe ? 'me' : ''}>
                    <span>{entry.rank}</span>
                    <strong>{entry.nickname}</strong>
                    <em>{`${entry.wins}${text.wins}`}</em>
                  </li>
                ))}
              </ol>
            ) : (
              <p>{text.emptyRanking}</p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  )
}

function OnlineVersusPanel({
  room,
  currentTurn,
  myOnlineStone,
}: {
  room: GomokuRoom | null
  currentTurn: Stone
  myOnlineStone: Stone | null
}) {
  const blackPlayer = room?.blackPlayer ?? null
  const whitePlayer = room?.whitePlayer ?? null
  const isPlaying = room?.status === 'PLAYING'

  return (
    <section className="gomoku-panel gomoku-online-versus">
      <div className="gomoku-online-versus-heading">
        <h2>{text.onlineMatch}</h2>
        <span>{room ? `${text.roomCode} ${room.roomCode}` : text.onlineLobbyGuide}</span>
      </div>
      <div className="gomoku-versus-grid">
        <OnlinePlayerCard
          stone="black"
          player={blackPlayer}
          fallbackName={room ? text.black : text.me}
          fallbackAvatarIndex={0}
          isMe={myOnlineStone === 'black'}
          isTurn={isPlaying && currentTurn === 'black'}
        />
        <span className="gomoku-versus-mark">{text.versus}</span>
        <OnlinePlayerCard
          stone="white"
          player={whitePlayer}
          fallbackName={room ? text.waiting : text.opponent}
          fallbackAvatarIndex={1}
          isMe={myOnlineStone === 'white'}
          isTurn={isPlaying && currentTurn === 'white'}
          isWaiting={Boolean(room && !whitePlayer)}
        />
      </div>
    </section>
  )
}

function OnlinePlayerCard({
  stone,
  player,
  fallbackName,
  fallbackAvatarIndex,
  isMe,
  isTurn,
  isWaiting = false,
}: {
  stone: Stone
  player: GomokuRoom['blackPlayer'] | null
  fallbackName: string
  fallbackAvatarIndex: number
  isMe: boolean
  isTurn: boolean
  isWaiting?: boolean
}) {
  const stoneLabel = stone === 'black' ? text.black : text.white
  const avatarSrc = getOnlineCharacterImage(player?.patientProfileId, fallbackAvatarIndex)

  return (
    <div
      className={[
        'gomoku-versus-player',
        stone,
        isMe ? 'me' : '',
        isTurn ? 'active' : '',
        isWaiting ? 'waiting' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="gomoku-versus-avatar">
        <img src={avatarSrc} alt="" aria-hidden="true" />
      </div>
      <div>
        <span>{isMe ? text.me : isWaiting ? text.waiting : text.opponent}</span>
        <strong>{player?.nickname ?? fallbackName}</strong>
        <em>
          {stoneLabel}
          {isTurn ? ` · ${text.current}` : ''}
        </em>
      </div>
    </div>
  )
}

function StatusBanner({
  status,
  currentTurn,
  isComputerThinking,
  mode,
  room,
  myOnlineStone,
  moveCount,
  message,
}: {
  status: GameStatus
  currentTurn: Stone
  isComputerThinking: boolean
  mode: GameMode
  room: GomokuRoom | null
  myOnlineStone: Stone | null
  moveCount: number
  message: string
}) {
  const presentation = getStatusPresentation({
    status,
    currentTurn,
    isComputerThinking,
    mode,
    room,
    myOnlineStone,
    moveCount,
    message,
  })

  return (
    <div className={`gomoku-status ${presentation.tone}`}>
      <div className="gomoku-status-copy">
        <em>{presentation.label}</em>
        <strong>{presentation.headline}</strong>
      </div>
      <p>{presentation.detail}</p>
    </div>
  )
}

function BoardPhaseOverlay({
  status,
  mode,
  room,
  currentTurn,
  myOnlineStone,
  moveCount,
  message,
}: {
  status: GameStatus
  mode: GameMode
  room: GomokuRoom | null
  currentTurn: Stone
  myOnlineStone: Stone | null
  moveCount: number
  message: string
}) {
  const shouldShow =
    status.phase !== 'playing' ||
    moveCount === 0 ||
    (mode === 'online' && (!room || room.status !== 'PLAYING'))

  if (!shouldShow) return null

  const presentation = getStatusPresentation({
    status,
    currentTurn,
    isComputerThinking: false,
    mode,
    room,
    myOnlineStone,
    moveCount,
    message,
  })

  return (
    <div className={`gomoku-board-phase ${presentation.tone}`}>
      <span>{presentation.label}</span>
      <strong>{presentation.headline}</strong>
      <em>{presentation.detail}</em>
    </div>
  )
}

function getStatusPresentation({
  status,
  currentTurn,
  isComputerThinking,
  mode,
  room,
  myOnlineStone,
  moveCount,
  message,
}: {
  status: GameStatus
  currentTurn: Stone
  isComputerThinking: boolean
  mode: GameMode
  room: GomokuRoom | null
  myOnlineStone: Stone | null
  moveCount: number
  message: string
}) {
  const turnDetail =
    mode === 'online' && myOnlineStone
      ? myOnlineStone === currentTurn
        ? text.myTurn
        : text.opponentTurn
      : `${currentTurn === 'black' ? text.black : text.white} ${text.current}`

  if (mode === 'online' && !room) {
    return {
      tone: 'online',
      label: text.onlineMatch,
      headline: text.lobby,
      detail: text.onlineLobbyGuide,
    } as const
  }

  if (room?.status === 'CANCELLED') {
    return {
      tone: 'ended',
      label: text.finished,
      headline: text.cancelled,
      detail: text.finishedRoomNextGame,
    } as const
  }

  if (status.phase === 'won') {
    const winner = status.winner === 'black' ? text.blackWins : text.whiteWins
    const reason = message || (status.reason === 'timeout' ? text.timeout : text.five)
    return {
      tone: 'ended',
      label: text.finished,
      headline: text.gameEnd,
      detail: `${winner} · ${reason}`,
    } as const
  }

  if (status.phase === 'draw') {
    return {
      tone: 'ended',
      label: text.finished,
      headline: text.gameEnd,
      detail: `${text.draw} · ${message || '\uBC14\uB451\uD310\uC774 \uAC00\uB4DD \uCC3C\uC5B4\uC694.'}`,
    } as const
  }

  if (mode === 'online' && room?.status === 'WAITING') {
    return {
      tone: 'online',
      label: `${text.roomCode} ${room.roomCode}`,
      headline: text.waitingOpponent,
      detail: text.onlineLobbyGuide,
    } as const
  }

  if (mode === 'online' && room?.status === 'PLAYING') {
    return {
      tone: 'online',
      label: `${text.roomCode} ${room.roomCode}`,
      headline: moveCount === 0 ? text.onlineGameStart : text.playing,
      detail: message || turnDetail,
    } as const
  }

  return {
    tone: 'playing',
    label: mode === 'computer' ? text.computer : text.local,
    headline: moveCount === 0 ? text.gameStart : text.playing,
    detail: isComputerThinking ? text.computerThinking : message || turnDetail,
  } as const
}

function getOnlineCharacterImage(patientProfileId: number | undefined, fallbackIndex: number) {
  const imageIndex =
    patientProfileId === undefined
      ? fallbackIndex
      : Math.abs(patientProfileId) % onlineCharacterImages.length
  return onlineCharacterImages[imageIndex]
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

function isValidPatientProfileId(value: number | undefined) {
  return Number.isInteger(value) && (value ?? 0) > 0
}

function getOnlineRequirementMessage() {
  if (DEMO_AUTH_ENABLED && !hasValidAuthToken()) return ''
  if (!hasValidAuthToken() && !DEMO_AUTH_ENABLED) return text.onlineAuthRequired
  return text.onlineProfileRequired
}

function getMyPatientProfileIdFromRoom(room: GomokuRoom) {
  if (room.myStone === 'BLACK') return room.blackPlayer.patientProfileId
  if (room.myStone === 'WHITE') return room.whitePlayer?.patientProfileId
  return undefined
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

function getOnlineGameStatus(room: GomokuRoom, fallback: GameStatus): GameStatus {
  if (room.status !== 'FINISHED') return room.status === 'PLAYING' ? fallback : { phase: 'playing' }
  if (room.result === 'DRAW') return { phase: 'draw', reason: 'board-full' }

  const winner: Stone = room.result === 'BLACK_WIN' ? 'black' : 'white'
  return {
    phase: 'won',
    winner,
    winningLine: fallback.phase === 'won' && fallback.winner === winner ? fallback.winningLine : [],
    reason: room.endReason === 'TIMEOUT' ? 'timeout' : 'five',
  }
}

function getOnlineStatusMessage(room: GomokuRoom, myStone: Stone | null, currentTurn: Stone) {
  if (room.status === 'WAITING') return text.waitingOpponent
  if (room.status === 'CANCELLED') return text.cancelled
  if (room.status === 'FINISHED') return formatEndReason(room.endReason)
  if (myStone === null) return currentTurn === 'black' ? text.black : text.white
  return myStone === currentTurn ? text.myTurn : text.opponentTurn
}

function formatEndReason(reason: GomokuEndReason | null) {
  if (reason === 'RESIGN') return text.resigned
  if (reason === 'LEAVE') return text.left
  if (reason === 'TIMEOUT') return text.timeout
  if (reason === 'BOARD_FULL') return text.draw
  return text.five
}

function calculateOnlineTimers(room: GomokuRoom, now: number): Record<Stone, number> {
  const timers: Record<Stone, number> = {
    black: room.timerSeconds,
    white: room.timerSeconds,
  }
  const startedAt = toTimestamp(room.startedAt)
  if (!startedAt) return timers

  let turnStartedAt = startedAt
  for (const move of room.moves) {
    const playedAt = toTimestamp(move.playedAt)
    if (!playedAt) continue
    const stone = fromApiStone(move.stone)
    timers[stone] = Math.max(0, timers[stone] - Math.floor((playedAt - turnStartedAt) / 1000))
    turnStartedAt = playedAt
  }

  if (room.status === 'PLAYING') {
    const current = fromApiStone(room.currentTurn)
    timers[current] = Math.max(0, timers[current] - Math.floor((now - turnStartedAt) / 1000))
  }

  return timers
}

function toLocalMove(move: GomokuRoom['moves'][number]): GomokuMove {
  return {
    position: { row: move.row, col: move.col },
    stone: fromApiStone(move.stone),
    source: 'human',
  }
}

function fromApiStone(stone: ApiGomokuStone): Stone {
  return stone === 'BLACK' ? 'black' : 'white'
}

function toApiRuleSet(rule: RuleSet): ApiGomokuRuleSet {
  return rule === 'renju-lite' ? 'RENJU_LITE' : 'FREESTYLE'
}

function fromApiRuleSet(rule: ApiGomokuRuleSet): RuleSet {
  return rule === 'RENJU_LITE' ? 'renju-lite' : 'freestyle'
}

function formatRoomStatus(room: GomokuRoom) {
  if (room.status === 'WAITING') return text.waiting
  if (room.status === 'PLAYING') return text.playing
  if (room.status === 'CANCELLED') return text.cancelled
  if (room.result === 'DRAW') return text.draw
  return room.winner?.nickname ?? text.five
}

function isClosedOnlineRoom(room: GomokuRoom) {
  return room.status === 'FINISHED' || room.status === 'CANCELLED'
}

function formatRuleSet(rule: RuleSet) {
  return rule === 'renju-lite' ? text.renju : text.freestyle
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

function toTimestamp(value: string | null | undefined) {
  if (!value) return null
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : null
}

type ApiErrorShape = {
  response?: {
    data?: {
      message?: string
    }
  }
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as ApiErrorShape).response
    if (response?.data?.message) return response.data.message
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function formatMoveNumber(position: Position) {
  return `${String.fromCharCode(65 + position.col)}${position.row + 1}`
}

function formatTime(seconds: number) {
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}
