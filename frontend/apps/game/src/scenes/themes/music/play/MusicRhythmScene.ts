import Phaser from 'phaser'
import { assetPath } from '@/game/assets/assetPath'
import { fadeToScene } from '@/game/systems/sceneTransition'
import { addCoverBackground } from '@/game/world/background'
import {
  TWINKLE_STAR_RHYTHM_CHART,
  type RhythmChart,
  type RhythmLane,
  type RhythmNote,
} from './rhythmCharts'

type ActiveNote = {
  note: RhythmNote
  icon: Phaser.GameObjects.Image
  resolved: boolean
}

type LaneView = {
  lane: RhythmLane
  x: number
  color: number
  track: Phaser.GameObjects.Graphics
  pad: Phaser.GameObjects.Graphics
  label: Phaser.GameObjects.Text
}

type SeekableSound = Phaser.Sound.BaseSound & {
  seek?: number
}

const FONT_FAMILY = '"Malgun Gothic", "Noto Sans KR", sans-serif'
const LANE_KEYS = ['A', 'S', 'D'] as const
const LANE_COLORS = [0x8ad7ff, 0xffcf7a, 0xff91b6] as const
const NOTE_LEAD_MS = 1_750
const PERFECT_WINDOW_MS = 70
const GOOD_WINDOW_MS = 130
const MISS_WINDOW_MS = 180
const HIT_LINE_RATIO = 0.76
const SPAWN_LINE_RATIO = 0.12

export class MusicRhythmScene extends Phaser.Scene {
  private readonly chart: RhythmChart = TWINKLE_STAR_RHYTHM_CHART
  private lanes: LaneView[] = []
  private activeNotes: ActiveNote[] = []
  private keyBindings: Phaser.Input.Keyboard.Key[] = []
  private music: SeekableSound | null = null
  private scoreText!: Phaser.GameObjects.Text
  private comboText!: Phaser.GameObjects.Text
  private judgmentText!: Phaser.GameObjects.Text
  private progressFill!: Phaser.GameObjects.Graphics
  private startOverlay!: Phaser.GameObjects.Container
  private hitLineY = 0
  private spawnLineY = 0
  private playWidth = 0
  private noteSize = 0
  private nextNoteIndex = 0
  private startTimeMs = 0
  private score = 0
  private combo = 0
  private maxCombo = 0
  private perfectCount = 0
  private goodCount = 0
  private missCount = 0
  private isStarted = false
  private isFinished = false
  private isLeaving = false

  private readonly handleSpaceDown = () => {
    if (this.isFinished) {
      this.restartRound()
      return
    }

    if (!this.isStarted) {
      this.startRound()
    }
  }

  private readonly handleEscDown = () => {
    this.returnToMusicSelect()
  }

  private readonly handleRestartDown = () => {
    if (this.isStarted || this.isFinished) {
      this.restartRound()
    }
  }

  constructor() {
    super({ key: 'MusicRhythmScene' })
  }

  preload() {
    this.load.image(
      'music-rhythm-background',
      assetPath('images/themes/music/background/background.png'),
    )
    this.load.audio(this.chart.audioKey, assetPath(this.chart.audioPath))
    Array.from({ length: 5 }, (_, index) => {
      this.load.image(
        `music-rhythm-note-${index + 1}`,
        assetPath(`images/themes/music/ui/note${index + 1}.png`),
      )
    })
  }

  create() {
    this.resetRoundState()

    const { width: vw, height: vh } = this.scale
    addCoverBackground(this, 'music-rhythm-background').setAlpha(0.72)
    this.add.rectangle(vw / 2, vh / 2, vw, vh, 0x151827, 0.54).setDepth(1)

    this.hitLineY = vh * HIT_LINE_RATIO
    this.spawnLineY = vh * SPAWN_LINE_RATIO
    this.playWidth = Phaser.Math.Clamp(vw * 0.64, Math.min(360, vw * 0.86), 820)
    this.noteSize = Phaser.Math.Clamp(Math.min(vw, vh) * 0.075, 46, 76)

    this.createHeader(vw, vh)
    this.createLaneViews(vw, vh)
    this.createProgressBar(vw, vh)
    this.createStartOverlay(vw, vh)
    this.bindKeyboard()

    this.input.once('pointerdown', () => {
      if (!this.isStarted && !this.isFinished) {
        this.startRound()
      }
    })

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.stopMusic()
      this.keyBindings.forEach(key => key.removeAllListeners())
      this.input.keyboard?.off('keydown-SPACE', this.handleSpaceDown)
      this.input.keyboard?.off('keydown-ESC', this.handleEscDown)
      this.input.keyboard?.off('keydown-R', this.handleRestartDown)
    })

    this.cameras.main.fadeIn(220, 0, 0, 0)
  }

  update() {
    if (!this.isStarted || this.isFinished) {
      return
    }

    const elapsedMs = this.getSongTimeMs()
    this.spawnDueNotes(elapsedMs)
    this.updateActiveNotes(elapsedMs)
    this.updateProgress(elapsedMs)

    if (elapsedMs >= this.chart.durationMs && this.activeNotes.length === 0) {
      this.finishRound()
    }
  }

  private resetRoundState() {
    this.lanes = []
    this.activeNotes = []
    this.keyBindings = []
    this.music = null
    this.nextNoteIndex = 0
    this.startTimeMs = 0
    this.score = 0
    this.combo = 0
    this.maxCombo = 0
    this.perfectCount = 0
    this.goodCount = 0
    this.missCount = 0
    this.isStarted = false
    this.isFinished = false
    this.isLeaving = false
  }

  private createHeader(vw: number, vh: number) {
    this.add
      .text(vw / 2, vh * 0.055, `${this.chart.title}  ·  ${this.chart.subtitle}`, {
        fontFamily: FONT_FAMILY,
        fontSize: `${Phaser.Math.Clamp(vh * 0.04, 28, 42)}px`,
        fontStyle: 'bold',
        color: '#fff7d6',
        stroke: '#46301a',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(20)
      .setScrollFactor(0)

    this.scoreText = this.add
      .text(vw * 0.07, vh * 0.11, 'SCORE 0', {
        fontFamily: FONT_FAMILY,
        fontSize: `${Phaser.Math.Clamp(vh * 0.027, 20, 28)}px`,
        fontStyle: 'bold',
        color: '#fff7d6',
      })
      .setOrigin(0, 0.5)
      .setDepth(20)
      .setScrollFactor(0)

    this.comboText = this.add
      .text(vw * 0.93, vh * 0.11, 'COMBO 0', {
        fontFamily: FONT_FAMILY,
        fontSize: `${Phaser.Math.Clamp(vh * 0.027, 20, 28)}px`,
        fontStyle: 'bold',
        color: '#fff7d6',
      })
      .setOrigin(1, 0.5)
      .setDepth(20)
      .setScrollFactor(0)

    this.judgmentText = this.add
      .text(vw / 2, vh * 0.28, '', {
        fontFamily: FONT_FAMILY,
        fontSize: `${Phaser.Math.Clamp(vh * 0.065, 42, 70)}px`,
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#312131',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(35)
      .setAlpha(0)
      .setScrollFactor(0)

    this.add
      .text(vw / 2, vh * 0.91, 'A  S  D 또는 아래 패드를 눌러 박자를 맞춰요', {
        fontFamily: FONT_FAMILY,
        fontSize: `${Phaser.Math.Clamp(vh * 0.023, 18, 25)}px`,
        fontStyle: 'bold',
        color: '#fff0c8',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(20)
      .setScrollFactor(0)
  }

  private createLaneViews(vw: number, vh: number) {
    const laneWidth = this.playWidth / 3
    const startX = vw / 2 - this.playWidth / 2 + laneWidth / 2
    const trackTop = vh * 0.16
    const trackHeight = this.hitLineY - trackTop + this.noteSize * 0.78
    const padHeight = Phaser.Math.Clamp(vh * 0.105, 74, 112)

    for (let index = 0; index < 3; index += 1) {
      const lane = index as RhythmLane
      const x = startX + laneWidth * index
      const color = LANE_COLORS[index]
      const track = this.add.graphics().setDepth(5)
      const pad = this.add.graphics().setDepth(16)

      track.fillStyle(0xffffff, 0.08)
      track.fillRoundedRect(x - laneWidth * 0.43, trackTop, laneWidth * 0.86, trackHeight, 18)
      track.lineStyle(3, color, 0.34)
      track.strokeRoundedRect(x - laneWidth * 0.43, trackTop, laneWidth * 0.86, trackHeight, 18)

      this.drawPad(pad, x, vh - padHeight * 0.75, laneWidth * 0.74, padHeight, color, 0.82)

      const label = this.add
        .text(x, vh - padHeight * 0.77, LANE_KEYS[index], {
          fontFamily: FONT_FAMILY,
          fontSize: `${Math.round(padHeight * 0.36)}px`,
          fontStyle: 'bold',
          color: '#33241a',
        })
        .setOrigin(0.5)
        .setDepth(18)
        .setScrollFactor(0)

      const zone = this.add
        .zone(x, vh - padHeight * 0.75, laneWidth * 0.82, padHeight * 1.08)
        .setInteractive({ cursor: 'pointer' })
        .setDepth(30)
        .setScrollFactor(0)
      zone.on('pointerdown', () => this.handleLaneInput(lane))

      this.lanes.push({ lane, x, color, track, pad, label })
    }

    const line = this.add.graphics().setDepth(14)
    line.lineStyle(6, 0xffffff, 0.9)
    line.lineBetween(
      vw / 2 - this.playWidth * 0.5,
      this.hitLineY,
      vw / 2 + this.playWidth * 0.5,
      this.hitLineY,
    )
    line.lineStyle(2, 0xfff2b0, 0.96)
    line.lineBetween(
      vw / 2 - this.playWidth * 0.48,
      this.hitLineY - 8,
      vw / 2 + this.playWidth * 0.48,
      this.hitLineY - 8,
    )
  }

  private drawPad(
    pad: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
    alpha: number,
  ) {
    pad.clear()
    pad.fillStyle(0x1c1420, 0.35)
    pad.fillRoundedRect(x - width / 2 + 5, y - height / 2 + 7, width, height, 16)
    pad.fillStyle(color, alpha)
    pad.fillRoundedRect(x - width / 2, y - height / 2, width, height, 16)
    pad.fillStyle(0xffffff, 0.28)
    pad.fillRoundedRect(x - width / 2 + 8, y - height / 2 + 7, width - 16, height * 0.34, 12)
    pad.lineStyle(3, 0xffffff, 0.78)
    pad.strokeRoundedRect(x - width / 2, y - height / 2, width, height, 16)
  }

  private createProgressBar(vw: number, vh: number) {
    const width = Math.min(vw * 0.58, 650)
    const height = Phaser.Math.Clamp(vh * 0.012, 8, 12)
    const x = vw / 2 - width / 2
    const y = vh * 0.12
    const frame = this.add.graphics().setDepth(19).setScrollFactor(0)
    frame.fillStyle(0xffffff, 0.16)
    frame.fillRoundedRect(x, y, width, height, height / 2)
    frame.lineStyle(2, 0xffffff, 0.28)
    frame.strokeRoundedRect(x, y, width, height, height / 2)

    this.progressFill = this.add.graphics().setDepth(20).setScrollFactor(0)
    this.progressFill.setData('x', x)
    this.progressFill.setData('y', y)
    this.progressFill.setData('width', width)
    this.progressFill.setData('height', height)
    this.updateProgress(0)
  }

  private createStartOverlay(vw: number, vh: number) {
    const dim = this.add.rectangle(0, 0, vw, vh, 0x10131f, 0.68).setOrigin(0).setDepth(45)
    const panelWidth = Math.min(vw * 0.72, 660)
    const panelHeight = Math.min(vh * 0.38, 320)
    const panel = this.add.graphics()
    panel.fillStyle(0xfff3cf, 0.96)
    panel.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 18)
    panel.lineStyle(4, 0xd19442, 0.92)
    panel.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 18)

    const title = this.add
      .text(0, -panelHeight * 0.24, '작은별 리듬게임', {
        fontFamily: FONT_FAMILY,
        fontSize: `${Phaser.Math.Clamp(vh * 0.046, 30, 48)}px`,
        fontStyle: 'bold',
        color: '#3b2a1f',
        align: 'center',
      })
      .setOrigin(0.5)

    const guide = this.add
      .text(0, panelHeight * 0.02, '음표가 선에 닿을 때 A S D를 눌러요', {
        fontFamily: FONT_FAMILY,
        fontSize: `${Phaser.Math.Clamp(vh * 0.026, 20, 28)}px`,
        fontStyle: 'bold',
        color: '#674728',
        align: 'center',
      })
      .setOrigin(0.5)

    const start = this.add
      .text(0, panelHeight * 0.26, '탭하거나 Space로 시작', {
        fontFamily: FONT_FAMILY,
        fontSize: `${Phaser.Math.Clamp(vh * 0.024, 18, 26)}px`,
        fontStyle: 'bold',
        color: '#9a4f20',
        align: 'center',
      })
      .setOrigin(0.5)

    this.startOverlay = this.add
      .container(vw / 2, vh / 2, [dim, panel, title, guide, start])
      .setDepth(45)
      .setScrollFactor(0)
  }

  private bindKeyboard() {
    const keyboard = this.input.keyboard
    if (!keyboard) {
      return
    }

    const laneKeyCodes = [
      Phaser.Input.Keyboard.KeyCodes.A,
      Phaser.Input.Keyboard.KeyCodes.S,
      Phaser.Input.Keyboard.KeyCodes.D,
    ]
    const arrowKeyCodes = [
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
    ]

    laneKeyCodes.forEach((keyCode, index) => {
      const key = keyboard.addKey(keyCode)
      const lane = index as RhythmLane
      key.on('down', () => this.handleLaneInput(lane))
      this.keyBindings.push(key)
    })

    arrowKeyCodes.forEach((keyCode, index) => {
      const key = keyboard.addKey(keyCode)
      const lane = index as RhythmLane
      key.on('down', () => this.handleLaneInput(lane))
      this.keyBindings.push(key)
    })

    keyboard.on('keydown-SPACE', this.handleSpaceDown)
    keyboard.on('keydown-ESC', this.handleEscDown)
    keyboard.on('keydown-R', this.handleRestartDown)
  }

  private startRound() {
    if (this.isStarted || this.isFinished) {
      return
    }

    this.isStarted = true
    this.startTimeMs = this.time.now
    this.startOverlay.destroy()
    this.music = this.sound.add(this.chart.audioKey, { volume: 0.78 }) as SeekableSound
    this.music.play()
  }

  private spawnDueNotes(elapsedMs: number) {
    while (
      this.nextNoteIndex < this.chart.notes.length &&
      this.chart.notes[this.nextNoteIndex].timeMs - elapsedMs <= NOTE_LEAD_MS
    ) {
      this.spawnNote(this.chart.notes[this.nextNoteIndex])
      this.nextNoteIndex += 1
    }
  }

  private spawnNote(note: RhythmNote) {
    const lane = this.lanes[note.lane]
    const icon = this.add
      .image(lane.x, this.spawnLineY, `music-rhythm-note-${(note.lane % 3) + 1}`)
      .setDisplaySize(this.noteSize, this.noteSize)
      .setTint(lane.color)
      .setDepth(12)
      .setAlpha(0.95)
      .setScrollFactor(0)

    this.activeNotes.push({ note, icon, resolved: false })
  }

  private updateActiveNotes(elapsedMs: number) {
    this.activeNotes.forEach(activeNote => {
      if (activeNote.resolved) {
        return
      }

      const untilHitMs = activeNote.note.timeMs - elapsedMs
      const progress = Phaser.Math.Clamp(1 - untilHitMs / NOTE_LEAD_MS, 0, 1.18)
      activeNote.icon.y = Phaser.Math.Linear(this.spawnLineY, this.hitLineY, progress)
      activeNote.icon.setAlpha(Phaser.Math.Clamp(progress * 1.4, 0.2, 0.98))

      if (elapsedMs - activeNote.note.timeMs > MISS_WINDOW_MS) {
        this.resolveMiss(activeNote)
      }
    })

    this.activeNotes = this.activeNotes.filter(activeNote => !activeNote.resolved)
  }

  private handleLaneInput(lane: RhythmLane) {
    if (this.isFinished) {
      return
    }

    if (!this.isStarted) {
      this.startRound()
      return
    }

    this.flashPad(lane)
    const elapsedMs = this.getSongTimeMs()
    const candidates = this.activeNotes
      .filter(activeNote => !activeNote.resolved && activeNote.note.lane === lane)
      .map(activeNote => ({
        activeNote,
        diffMs: Math.abs(activeNote.note.timeMs - elapsedMs),
      }))
      .filter(candidate => candidate.diffMs <= MISS_WINDOW_MS)
      .sort((a, b) => a.diffMs - b.diffMs)

    const best = candidates[0]
    if (!best) {
      this.breakCombo()
      this.showJudgment('MISS', '#f87171')
      return
    }

    if (best.diffMs <= PERFECT_WINDOW_MS) {
      this.resolveHit(best.activeNote, 'PERFECT', 1_000, '#fff4a8')
      return
    }

    if (best.diffMs <= GOOD_WINDOW_MS) {
      this.resolveHit(best.activeNote, 'GOOD', 650, '#a7f3d0')
      return
    }

    this.resolveMiss(best.activeNote)
  }

  private resolveHit(
    activeNote: ActiveNote,
    label: 'PERFECT' | 'GOOD',
    baseScore: number,
    color: string,
  ) {
    activeNote.resolved = true
    this.combo += 1
    this.maxCombo = Math.max(this.maxCombo, this.combo)
    this.score += baseScore + this.combo * 12

    if (label === 'PERFECT') {
      this.perfectCount += 1
    } else {
      this.goodCount += 1
    }

    this.updateScoreHud()
    this.showJudgment(label, color)
    this.spawnBurst(activeNote.icon.x, this.hitLineY, activeNote.note.lane)
    this.tweens.add({
      targets: activeNote.icon,
      scale: 1.35,
      alpha: 0,
      duration: 130,
      ease: 'Sine.easeOut',
      onComplete: () => activeNote.icon.destroy(),
    })
  }

  private resolveMiss(activeNote: ActiveNote) {
    activeNote.resolved = true
    this.missCount += 1
    this.breakCombo()
    this.showJudgment('MISS', '#f87171')
    this.tweens.add({
      targets: activeNote.icon,
      y: this.hitLineY + this.noteSize * 0.5,
      alpha: 0,
      duration: 120,
      ease: 'Sine.easeIn',
      onComplete: () => activeNote.icon.destroy(),
    })
  }

  private breakCombo() {
    this.combo = 0
    this.updateScoreHud()
  }

  private flashPad(lane: RhythmLane) {
    const pad = this.lanes[lane].pad
    this.tweens.killTweensOf(pad)
    pad.setAlpha(1)
    this.tweens.add({
      targets: pad,
      alpha: 0.72,
      duration: 120,
      ease: 'Sine.easeOut',
    })
  }

  private spawnBurst(x: number, y: number, lane: RhythmLane) {
    const color = this.lanes[lane].color
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8
      const sparkle = this.add
        .circle(x, y, Phaser.Math.Between(4, 8), color, 0.86)
        .setDepth(24)
        .setScrollFactor(0)
      this.tweens.add({
        targets: sparkle,
        x: x + Math.cos(angle) * Phaser.Math.Between(28, 54),
        y: y + Math.sin(angle) * Phaser.Math.Between(22, 42),
        alpha: 0,
        scale: 0.35,
        duration: 260,
        ease: 'Sine.easeOut',
        onComplete: () => sparkle.destroy(),
      })
    }
  }

  private showJudgment(label: string, color: string) {
    this.tweens.killTweensOf(this.judgmentText)
    this.judgmentText
      .setText(label)
      .setColor(color)
      .setAlpha(1)
      .setScale(0.96)
      .setY(this.scale.height * 0.28)

    this.tweens.add({
      targets: this.judgmentText,
      y: this.scale.height * 0.25,
      alpha: 0,
      scale: 1.05,
      duration: 420,
      ease: 'Sine.easeOut',
    })
  }

  private updateScoreHud() {
    this.scoreText.setText(`SCORE ${this.score.toLocaleString('ko-KR')}`)
    this.comboText.setText(`COMBO ${this.combo}`)
  }

  private updateProgress(elapsedMs: number) {
    const x = this.progressFill.getData('x') as number
    const y = this.progressFill.getData('y') as number
    const width = this.progressFill.getData('width') as number
    const height = this.progressFill.getData('height') as number
    const progress = Phaser.Math.Clamp(elapsedMs / this.chart.durationMs, 0, 1)

    this.progressFill.clear()
    this.progressFill.fillStyle(0xffd166, 0.96)
    this.progressFill.fillRoundedRect(x, y, width * progress, height, height / 2)
  }

  private getSongTimeMs() {
    const seekSeconds = this.music?.seek
    if (typeof seekSeconds === 'number' && seekSeconds >= 0) {
      return seekSeconds * 1_000
    }

    return this.time.now - this.startTimeMs
  }

  private finishRound() {
    if (this.isFinished) {
      return
    }

    this.isFinished = true
    this.stopMusic()
    this.showResultOverlay()
  }

  private showResultOverlay() {
    const { width: vw, height: vh } = this.scale
    const dim = this.add.rectangle(0, 0, vw, vh, 0x11131f, 0.72).setOrigin(0)
    const panelWidth = Math.min(vw * 0.76, 720)
    const panelHeight = Math.min(vh * 0.58, 470)
    const panel = this.add.graphics()
    panel.fillStyle(0xfff4d6, 0.97)
    panel.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 18)
    panel.lineStyle(4, 0xd19442, 0.95)
    panel.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 18)

    const title = this.add
      .text(0, -panelHeight * 0.31, '연주 완료!', {
        fontFamily: FONT_FAMILY,
        fontSize: `${Phaser.Math.Clamp(vh * 0.052, 34, 54)}px`,
        fontStyle: 'bold',
        color: '#3b2a1f',
      })
      .setOrigin(0.5)

    const summary = this.add
      .text(
        0,
        -panelHeight * 0.03,
        [
          `점수 ${this.score.toLocaleString('ko-KR')}`,
          `최대 콤보 ${this.maxCombo}`,
          `Perfect ${this.perfectCount}   Good ${this.goodCount}   Miss ${this.missCount}`,
        ],
        {
          fontFamily: FONT_FAMILY,
          fontSize: `${Phaser.Math.Clamp(vh * 0.026, 20, 28)}px`,
          fontStyle: 'bold',
          color: '#594026',
          align: 'center',
          lineSpacing: 12,
        },
      )
      .setOrigin(0.5)

    const retryButton = this.createTextButton(
      -panelWidth * 0.18,
      panelHeight * 0.31,
      190,
      64,
      '다시하기',
      () => this.restartRound(),
    )
    const exitButton = this.createTextButton(
      panelWidth * 0.18,
      panelHeight * 0.31,
      190,
      64,
      '돌아가기',
      () => this.returnToMusicSelect(),
    )

    this.add
      .container(vw / 2, vh / 2, [dim, panel, title, summary, retryButton, exitButton])
      .setDepth(55)
      .setScrollFactor(0)
  }

  private createTextButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onClick: () => void,
  ) {
    const container = this.add.container(x, y)
    const bg = this.add.graphics()
    const text = this.add
      .text(0, 0, label, {
        fontFamily: FONT_FAMILY,
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#fff6df',
      })
      .setOrigin(0.5)

    const draw = (hovered: boolean) => {
      bg.clear()
      bg.fillStyle(hovered ? 0xb96f2d : 0x9f5f28, 1)
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, 12)
      bg.lineStyle(3, 0x4a2a12, 0.95)
      bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 12)
    }
    draw(false)

    const zone = this.add.zone(0, 0, width, height).setInteractive({ cursor: 'pointer' })
    zone.on('pointerover', () => draw(true))
    zone.on('pointerout', () => draw(false))
    zone.on('pointerdown', onClick)

    container.add([bg, text, zone])
    return container
  }

  private restartRound() {
    if (this.isLeaving) {
      return
    }

    this.stopMusic()
    this.scene.restart()
  }

  private returnToMusicSelect() {
    if (this.isLeaving) {
      return
    }

    this.isLeaving = true
    this.stopMusic()
    fadeToScene(this, 'MusicSelectScene', { duration: 220 })
  }

  private stopMusic() {
    this.music?.stop()
    this.music?.destroy()
    this.music = null
  }
}
