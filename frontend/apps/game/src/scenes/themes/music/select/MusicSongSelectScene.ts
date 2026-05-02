import Phaser from 'phaser'
import { assetPath } from '@/game/assets/assetPath'
import { fadeToScene } from '@/game/systems/sceneTransition'
import { addCoverBackground } from '@/game/world/background'
import { ALL_RHYTHM_CHARTS, type RhythmChart } from '../play/rhythmCharts'

const FONT_FAMILY = '"Pretendard", "Inter", "Noto Sans KR", "Malgun Gothic", sans-serif'

type SongMeta = {
  chart: RhythmChart
  coverKey: string
  coverPath: string
  accent: number
  tag: string
}

type SongCardView = {
  meta: SongMeta
  container: Phaser.GameObjects.Container
  panel: Phaser.GameObjects.Graphics
  glow: Phaser.GameObjects.Graphics
  playBtn: Phaser.GameObjects.Graphics
  playLabel: Phaser.GameObjects.Text
  index: number
  width: number
  height: number
}

const SONG_META: SongMeta[] = [
  {
    chart: ALL_RHYTHM_CHARTS[0], // 아기상어
    coverKey: 'song-cover-baby-shark',
    coverPath: 'images/themes/music/ui/babyshark_thum.png',
    accent: 0x65d8ff,
    tag: '동요 · POP',
  },
  {
    chart: ALL_RHYTHM_CHARTS[1], // 작은별
    coverKey: 'song-cover-twinkle',
    coverPath: 'images/themes/music/ui/littlestart_thum.png',
    accent: 0xc8b6ff,
    tag: '클래식 · 입문',
  },
]

export class MusicSongSelectScene extends Phaser.Scene {
  private cards: SongCardView[] = []
  private selectedIndex = 0
  private hoveredIndex: number | null = null
  private isLeaving = false

  constructor() {
    super({ key: 'MusicSongSelectScene' })
  }

  preload() {
    this.load.image('music-background', assetPath('images/themes/music/background/background.png'))
    SONG_META.forEach(meta => {
      this.load.image(meta.coverKey, assetPath(meta.coverPath))
    })
  }

  create() {
    this.cards = []
    this.selectedIndex = 0
    this.hoveredIndex = null
    this.isLeaving = false

    const { width: vw, height: vh } = this.scale
    addCoverBackground(this, 'music-background')
    this.createBackdrop(vw, vh)

    this.createHeader(vw, vh)
    this.createCards(vw, vh)
    this.createBackButton(vw, vh)
    this.createHint(vw, vh)
    this.bindInput()

    this.refreshCardStates()
    this.cameras.main.fadeIn(220, 0, 0, 0)
  }

  private createBackdrop(vw: number, vh: number) {
    // strong dim — let cards take all focus
    this.add.rectangle(vw / 2, vh / 2, vw, vh, 0x050507, 0.72).setDepth(1)

    // subtle bottom vignette for depth
    const scrim = this.add.graphics().setDepth(2)
    for (let i = 0; i < 14; i++) {
      scrim.fillStyle(0x000000, 0.018)
      scrim.fillRect(0, vh - (i + 1) * (vh / 14), vw, vh / 14)
    }
  }

  // ─────────────── header / footer ───────────────

  private createHeader(vw: number, vh: number) {
    this.add
      .text(vw / 2, vh * 0.085, '곡 선택', {
        fontFamily: FONT_FAMILY,
        fontSize: `${Phaser.Math.Clamp(vh * 0.047, 30, 46)}px`,
        fontStyle: 'bold',
        color: '#fffaf2',
        stroke: '#0b0b0c',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(20)
      .setShadow(0, 3, '#000000', 10, false, true)

    const ulW = Math.min(vw * 0.075, 86)
    const underline = this.add.graphics().setDepth(20)
    underline.fillStyle(0x65d8ff, 0.9)
    underline.fillRoundedRect(vw / 2 - ulW / 2, vh * 0.128, ulW, 2, 2)

    this.add
      .text(vw / 2, vh * 0.16, '플레이할 곡을 골라주세요', {
        fontFamily: FONT_FAMILY,
        fontSize: `${Phaser.Math.Clamp(vh * 0.02, 13, 17)}px`,
        fontStyle: 'bold',
        color: '#c9ced8',
        stroke: '#050506',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(20)
  }

  private createBackButton(vw: number, vh: number) {
    const btnW = Math.min(vw * 0.12, 140)
    const btnH = Math.min(vh * 0.055, 44)
    const x = vw * 0.04 + btnW / 2
    const y = vh * 0.93 - btnH / 2

    const container = this.add.container(x, y).setDepth(30)
    const bg = this.add.graphics()
    const draw = (hovered: boolean) => {
      bg.clear()
      bg.fillStyle(0x111114, hovered ? 0.88 : 0.66)
      bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, btnH / 2)
      bg.lineStyle(1.5, hovered ? 0x65d8ff : 0xffffff, hovered ? 0.9 : 0.16)
      bg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, btnH / 2)
    }
    draw(false)

    const label = this.add
      .text(0, 0, '← 돌아가기', {
        fontFamily: FONT_FAMILY,
        fontSize: `${Phaser.Math.Clamp(vh * 0.022, 14, 18)}px`,
        fontStyle: 'bold',
        color: '#eef1f6',
        stroke: '#050506',
        strokeThickness: 2,
      })
      .setOrigin(0.5)

    const zone = this.add.zone(0, 0, btnW, btnH).setInteractive({ cursor: 'pointer' })
    zone.on('pointerover', () => draw(true))
    zone.on('pointerout', () => draw(false))
    zone.on('pointerdown', () => this.returnToHub())

    container.add([bg, label, zone])
  }

  private createHint(vw: number, vh: number) {
    this.add
      .text(vw / 2, vh * 0.95, '← →  곡 선택   ENTER  플레이   ESC  돌아가기', {
        fontFamily: FONT_FAMILY,
        fontSize: `${Phaser.Math.Clamp(vh * 0.018, 12, 15)}px`,
        fontStyle: 'bold',
        color: '#bfc3cc',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(30)
  }

  // ─────────────── cards ───────────────

  private createCards(vw: number, vh: number) {
    const count = SONG_META.length
    // square-ish cards, tighter
    const cardW = Phaser.Math.Clamp(vw * 0.2, 240, 300)
    const cardH = Phaser.Math.Clamp(vh * 0.55, 340, 440)
    const gap = Phaser.Math.Clamp(vw * 0.018, 18, 32)
    const totalW = count * cardW + (count - 1) * gap
    const startX = vw * 0.5 - totalW / 2 + cardW / 2
    const centerY = vh * 0.55

    SONG_META.forEach((meta, index) => {
      const x = startX + index * (cardW + gap)
      this.cards.push(this.buildCard(meta, x, centerY, cardW, cardH, index))
    })
  }

  private buildCard(
    meta: SongMeta,
    x: number,
    y: number,
    w: number,
    h: number,
    index: number,
  ): SongCardView {
    const container = this.add.container(x, y).setDepth(24).setSize(w, h)

    const glow = this.add.graphics()
    container.add(glow)

    const panel = this.add.graphics()
    container.add(panel)

    // ── cover fills the ENTIRE card ──
    const cover = this.add.image(0, 0, meta.coverKey)
    const src = cover.texture.getSourceImage() as HTMLImageElement
    const scale = Math.max(w / src.width, h / src.height)
    cover.setScale(scale)

    const maskShape = this.make.graphics({ x: 0, y: 0 }, false)
    maskShape.fillStyle(0xffffff)
    maskShape.fillRoundedRect(x - w / 2, y - h / 2, w, h, 16)
    cover.setMask(maskShape.createGeometryMask())
    container.add(cover)

    // dark gradient at bottom for text legibility
    const fade = this.add.graphics()
    const fadeH = Math.round(h * 0.5)
    for (let i = 0; i < 12; i++) {
      const t = i / 11
      fade.fillStyle(0x000000, 0.06)
      const stripH = fadeH * (1 - t * 0.85)
      fade.fillRect(-w / 2, h / 2 - stripH, w, stripH)
    }
    fade.setMask(maskShape.createGeometryMask())
    container.add(fade)

    // tag pill — minimal, dark glass
    const tagPad = 9
    const tagText = this.add
      .text(0, 0, meta.tag, {
        fontFamily: FONT_FAMILY,
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#f0f3f8',
      })
      .setLetterSpacing(0.5)
    const tagW = tagText.width + tagPad * 2
    const tagH = 20
    const tagX = -w / 2 + tagW / 2 + 18
    const tagY = -h / 2 + tagH / 2 + 18
    const tagBg = this.add.graphics()
    tagBg.fillStyle(0x000000, 0.52)
    tagBg.fillRoundedRect(tagX - tagW / 2, tagY - tagH / 2, tagW, tagH, tagH / 2)
    tagText.setPosition(tagX, tagY).setOrigin(0.5)
    container.add([tagBg, tagText])

    // ── title + meta overlaid on bottom of cover (inset from edges) ──
    const textPadX = 24
    const titleY = h / 2 - 62

    const title = this.add
      .text(-w / 2 + textPadX, titleY, meta.chart.title, {
        fontFamily: FONT_FAMILY,
        fontSize: `${Math.round(Phaser.Math.Clamp(h * 0.062, 22, 28))}px`,
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0, 0)
      .setShadow(0, 2, '#000000', 6, false, true)

    const noteCountText = `${meta.chart.notes.length}`
    const durationStr = formatDuration(meta.chart.durationMs)
    const meta1 = this.add
      .text(-w / 2 + textPadX, h / 2 - 28, `${durationStr}  ·  노트 ${noteCountText}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#c5cad4',
      })
      .setOrigin(0, 0)
      .setShadow(0, 1, '#000000', 4, false, true)

    container.add([title, meta1])

    // ── play indicator (top-right circle, lights up on hover) ──
    const playR = 18
    const playX = w / 2 - playR - 18
    const playY = -h / 2 + playR + 18
    const playBtn = this.add.graphics()
    const playLabel = this.add
      .text(playX + 1, playY, '▶', {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
    container.add([playBtn, playLabel])

    container.setData('playX', playX)
    container.setData('playY', playY)
    container.setData('playR', playR)

    // click zone
    const zone = this.add.zone(0, 0, w, h).setInteractive({ cursor: 'pointer' })
    zone.on('pointerover', () => {
      this.hoveredIndex = index
      this.refreshCardStates()
    })
    zone.on('pointerout', () => {
      if (this.hoveredIndex === index) {
        this.hoveredIndex = null
        this.refreshCardStates()
      }
    })
    zone.on('pointerdown', () => {
      this.selectedIndex = index
      this.refreshCardStates()
      this.startSelectedSong()
    })
    container.add(zone)

    return { meta, container, panel, glow, playBtn, playLabel, index, width: w, height: h }
  }

  private refreshCardStates() {
    this.cards.forEach((card, i) => {
      const isSelected = i === this.selectedIndex
      const isHovered = i === this.hoveredIndex
      this.drawPanel(card, isSelected, isHovered)
    })
  }

  private drawPanel(card: SongCardView, isSelected: boolean, isHovered: boolean) {
    const { panel, glow, playBtn, playLabel, width: w, height: h, meta } = card
    const active = isSelected || isHovered

    glow.clear()
    panel.clear()
    playBtn.clear()

    // soft drop shadow under card
    panel.fillStyle(0x000000, 0.45)
    panel.fillRoundedRect(-w / 2 + 2, -h / 2 + 10, w, h, 16)

    // selected/hover glow — wider radius so selection is clear without scaling
    if (active) {
      const steps = 14
      const reach = isSelected ? 36 : 22
      const perStepAlpha = isSelected ? 0.022 : 0.014
      for (let g = 0; g < steps; g++) {
        glow.fillStyle(meta.accent, perStepAlpha)
        const inset = (g / steps) * reach
        glow.fillRoundedRect(
          -w / 2 - reach + inset,
          -h / 2 - reach + inset,
          w + reach * 2 - inset * 2,
          h + reach * 2 - inset * 2,
          22,
        )
      }
    }

    // single accent border (only when active)
    if (active) {
      panel.lineStyle(isSelected ? 2.2 : 1.5, meta.accent, isSelected ? 1 : 0.7)
      panel.strokeRoundedRect(-w / 2, -h / 2, w, h, 16)
    } else {
      panel.lineStyle(1, 0xffffff, 0.08)
      panel.strokeRoundedRect(-w / 2, -h / 2, w, h, 16)
    }

    // ── play indicator circle ──
    const pX = card.container.getData('playX') as number
    const pY = card.container.getData('playY') as number
    const pR = card.container.getData('playR') as number

    if (active) {
      // soft glow ring
      for (let g = 0; g < 5; g++) {
        playBtn.fillStyle(meta.accent, 0.04)
        playBtn.fillCircle(pX, pY, pR + 4 - g * 0.8)
      }
      playBtn.fillStyle(meta.accent, 0.95)
      playBtn.fillCircle(pX, pY, pR)
      playLabel.setColor('#0a0a0c')
    } else {
      playBtn.fillStyle(0x000000, 0.55)
      playBtn.fillCircle(pX, pY, pR)
      playBtn.lineStyle(1, 0xffffff, 0.25)
      playBtn.strokeCircle(pX, pY, pR)
      playLabel.setColor('#ffffff')
    }
  }

  // ─────────────── input ───────────────

  private bindInput() {
    const keyboard = this.input.keyboard
    if (!keyboard) return

    keyboard.on('keydown-LEFT', () => this.moveSelection(-1))
    keyboard.on('keydown-RIGHT', () => this.moveSelection(1))
    keyboard.on('keydown-A', () => this.moveSelection(-1))
    keyboard.on('keydown-D', () => this.moveSelection(1))
    keyboard.on('keydown-ENTER', () => this.startSelectedSong())
    keyboard.on('keydown-SPACE', () => this.startSelectedSong())
    keyboard.on('keydown-ESC', () => this.returnToHub())
  }

  private moveSelection(delta: number) {
    const next = (this.selectedIndex + delta + this.cards.length) % this.cards.length
    if (next === this.selectedIndex) return
    this.selectedIndex = next
    this.refreshCardStates()
  }

  private startSelectedSong() {
    if (this.isLeaving) return
    const card = this.cards[this.selectedIndex]
    if (!card) return
    this.isLeaving = true
    fadeToScene(this, 'MusicRhythmScene', {
      duration: 220,
      data: { chartId: card.meta.chart.id },
    })
  }

  private returnToHub() {
    if (this.isLeaving) return
    this.isLeaving = true
    fadeToScene(this, 'MusicSelectScene', { duration: 220 })
  }
}

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
