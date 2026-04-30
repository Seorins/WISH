import Phaser from 'phaser'
import {
  getGameSettings,
  type MoveSpeedMultiplier,
  updateGameSettings,
} from '@/game/settings/gameSettings'

type SettingsMenu = {
  isOpen: () => boolean
  toggleButton: () => void
  close: () => void
}

type SettingsMenuOptions = {
  onLogout: () => void
}

type ClickZone = {
  x: number
  y: number
  width: number
  height: number
  onClick: () => void
}

type SliderZone = {
  x: number
  y: number
  width: number
  height: number
  setValue: (pointerX: number) => void
}

const OVERLAY_DEPTH = 1000
const MENU_FRAME_KEY = 'menu-frame'
const SETTING_FRAME_KEY = 'setting-frame'
const SETTINGS_BUTTON_KEY = 'settings-button'
const EXIT_BUTTON_KEY = 'exit-button'
const MENU_FRAME_VISIBLE = 'menu-frame-visible'
const SETTINGS_BUTTON_FRAME = 'settings-button-visible'
const EXIT_BUTTON_FRAME = 'exit-button-visible'
const MENU_FRAME_BOUNDS = {
  frame: MENU_FRAME_VISIBLE,
  x: 100,
  y: 285,
  width: 828,
  height: 887,
} as const
const BUTTON_VISIBLE_FRAMES = {
  [SETTINGS_BUTTON_KEY]: {
    frame: SETTINGS_BUTTON_FRAME,
    x: 184,
    y: 128,
    width: 1637,
    height: 415,
  },
  [EXIT_BUTTON_KEY]: {
    frame: EXIT_BUTTON_FRAME,
    x: 245,
    y: 131,
    width: 1513,
    height: 406,
  },
} as const
const SETTING_FRAME_SLICES = {
  top: 'setting-frame-top',
  middle: 'setting-frame-middle',
  bottom: 'setting-frame-bottom',
  source: {
    x: 102,
    y: 282,
    width: 830,
    height: 885,
  },
  topHeight: 300,
  middleHeight: 120,
  bottomHeight: 260,
} as const

const LABELS = {
  settings: '\uC124\uC815\uCC3D',
  quit: '\uC885\uB8CC\uD558\uAE30',
  sound: '\uC0AC\uC6B4\uB4DC',
  effect: '\uD6A8\uACFC\uC74C',
  speed: '\uC774\uB3D9 \uBC30\uC18D',
}

export function createSettingsMenu(
  scene: Phaser.Scene,
  { onLogout }: SettingsMenuOptions,
): SettingsMenu {
  const { width, height } = scene.scale
  let settings = getGameSettings()
  let modal: Phaser.GameObjects.Container | null = null
  let clickZones: ClickZone[] = []
  let sliderZones: SliderZone[] = []
  let activeSlider: SliderZone | null = null
  ensureMenuFrame(scene)
  ensureButtonVisibleFrames(scene)
  ensureSettingFrameSlices(scene)

  function toggleButton() {
    if (modal) {
      close()
      return
    }
    openMenu()
  }

  function close() {
    modal?.destroy()
    modal = null
    clickZones = []
    sliderZones = []
    activeSlider = null
  }

  function createOverlay() {
    close()
    const container = scene.add.container(0, 0).setDepth(OVERLAY_DEPTH).setScrollFactor(0)
    const dim = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.42)
    container.add(dim)
    modal = container
    return container
  }

  function openMenu() {
    const container = createOverlay()
    const { frameW, frameH } = getMenuFrameSize(scene, 0.48, 0.62, 400)
    const panelX = width / 2
    const panelY = height / 2
    const buttonW = Math.min(270, width * 0.25)
    const buttonH = buttonW * 0.255
    const buttonGap = frameH * 0.09
    const groupCenterY = panelY + frameH * 0.04
    const settingY = groupCenterY - buttonH / 2 - buttonGap / 2
    const exitY = groupCenterY + buttonH / 2 + buttonGap / 2

    container.add(createMenuFrame(scene, panelX, panelY, frameW, frameH))
    container.add(
      createImageButton(
        scene,
        panelX,
        settingY,
        SETTINGS_BUTTON_KEY,
        SETTINGS_BUTTON_FRAME,
        buttonW,
        buttonH,
        () => openSettings(),
      ),
    )
    addClickZone(panelX, settingY, buttonW, buttonH, () => openSettings())
    container.add(
      createImageButton(
        scene,
        panelX,
        exitY,
        EXIT_BUTTON_KEY,
        EXIT_BUTTON_FRAME,
        buttonW,
        buttonH,
        onLogout,
      ),
    )
    addClickZone(panelX, exitY, buttonW, buttonH, onLogout)
  }

  function openSettings() {
    const container = createOverlay()
    const { frameW: panelW, frameH: panelH } = getSettingsFrameSize(scene)
    const panelX = width / 2
    const panelY = height / 2
    const contentLeft = panelX - panelW * 0.29
    const contentRight = panelX + panelW * 0.29
    const labelW = panelW * 0.17
    const valueW = panelW * 0.06
    const sliderW = contentRight - contentLeft - labelW - valueW
    const closeX = panelX + panelW * 0.285
    const closeY = panelY - panelH * 0.285
    const rowGap = panelH * 0.12
    const sliderStartY = panelY - panelH * 0.145
    const speedY = sliderStartY + rowGap * 2

    container.add(createSettingFrame(scene, panelX, panelY, panelW, panelH))
    container.add(createSmallButton(scene, closeX, closeY, 42, 36, 'X', () => openMenu()))
    addClickZone(closeX, closeY, 42, 36, () => openMenu())

    const masterSlider = createSlider(scene, {
      x: contentLeft,
      y: sliderStartY,
      labelWidth: labelW,
      sliderWidth: sliderW,
      label: LABELS.sound,
      value: settings.masterVolume,
      onChange: value => {
        settings = updateGameSettings({ masterVolume: value })
        applyMasterVolume(scene, value)
      },
    })
    container.add(masterSlider.container)
    addSliderZone(masterSlider)

    const effectSlider = createSlider(scene, {
      x: contentLeft,
      y: sliderStartY + rowGap,
      labelWidth: labelW,
      sliderWidth: sliderW,
      label: LABELS.effect,
      value: settings.effectVolume,
      onChange: value => {
        settings = updateGameSettings({ effectVolume: value })
      },
    })
    container.add(effectSlider.container)
    addSliderZone(effectSlider)

    container.add(
      scene.add
        .text(contentLeft, speedY, LABELS.speed, {
          fontFamily: 'sans-serif',
          fontSize: '19px',
          color: '#5c3213',
          fontStyle: 'bold',
        })
        .setOrigin(0, 0.5),
    )

    const speedButtons: Phaser.GameObjects.Container[] = []
    const speedButtonGap = 14
    const speedButtonW = Math.min(
      88,
      (contentRight - contentLeft - labelW - speedButtonGap * 2) / 3,
    )
    const speedButtonH = Math.min(38, panelH * 0.074)
    const speedGroupStartX = contentLeft + labelW + 12 + speedButtonW / 2
    const refreshSpeedButtons = () => {
      speedButtons.forEach(button => {
        const bg = button.getAt(0) as Phaser.GameObjects.Graphics
        bg.clear()
        const value = button.getData('value') as MoveSpeedMultiplier
        const selected = value === settings.moveSpeedMultiplier
        drawButtonBg(
          bg,
          speedButtonW,
          speedButtonH,
          selected ? 0xf2c66d : 0x8f5b2b,
          selected ? 0xfff1c4 : 0xd08a39,
        )
      })
    }

    ;([1, 1.5, 2] as MoveSpeedMultiplier[]).forEach((value, index) => {
      const button = createSmallButton(
        scene,
        speedGroupStartX + index * (speedButtonW + speedButtonGap),
        speedY,
        speedButtonW,
        speedButtonH,
        `X ${value}`,
        () => {
          settings = updateGameSettings({ moveSpeedMultiplier: value })
          refreshSpeedButtons()
        },
      )
      button.setData('value', value)
      speedButtons.push(button)
      container.add(button)
      addClickZone(
        speedGroupStartX + index * (speedButtonW + speedButtonGap),
        speedY,
        speedButtonW,
        speedButtonH,
        () => {
          settings = updateGameSettings({ moveSpeedMultiplier: value })
          refreshSpeedButtons()
        },
      )
    })
    refreshSpeedButtons()
  }

  function addClickZone(x: number, y: number, width: number, height: number, onClick: () => void) {
    clickZones.push({ x, y, width, height, onClick })
  }

  function addSliderZone(zone: SliderZone) {
    sliderZones.push(zone)
  }

  const handlePointerDown = (pointer: Phaser.Input.Pointer) => {
    if (!modal) return

    const sliderZone = sliderZones.find(zone => isPointInZone(pointer.x, pointer.y, zone))
    if (sliderZone) {
      activeSlider = sliderZone
      sliderZone.setValue(pointer.x)
      return
    }

    const zone = clickZones.find(zone => isPointInZone(pointer.x, pointer.y, zone))
    zone?.onClick()
  }
  const handlePointerMove = (pointer: Phaser.Input.Pointer) => {
    if (!activeSlider || !pointer.isDown) return
    activeSlider.setValue(pointer.x)
  }
  const handlePointerUp = () => {
    activeSlider = null
  }
  scene.input.on('pointerdown', handlePointerDown)
  scene.input.on('pointermove', handlePointerMove)
  scene.input.on('pointerup', handlePointerUp)

  applyMasterVolume(scene, settings.masterVolume)
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.input.off('pointerdown', handlePointerDown)
    scene.input.off('pointermove', handlePointerMove)
    scene.input.off('pointerup', handlePointerUp)
    close()
  })

  return {
    isOpen: () => Boolean(modal),
    toggleButton,
    close,
  }
}

function getMenuFrameSize(
  scene: Phaser.Scene,
  widthRatio = 0.86,
  heightRatio = 0.88,
  maxWidth = 720,
) {
  const aspect = MENU_FRAME_BOUNDS.height / MENU_FRAME_BOUNDS.width
  let frameW = Math.min(maxWidth, scene.scale.width * widthRatio)
  let frameH = frameW * aspect
  const maxH = scene.scale.height * heightRatio

  if (frameH > maxH) {
    frameH = maxH
    frameW = frameH / aspect
  }

  return { frameW, frameH }
}

function getSettingsFrameSize(scene: Phaser.Scene) {
  const source = SETTING_FRAME_SLICES.source
  const maxW = Math.min(520, scene.scale.width * 0.58)
  const maxH = Math.min(500, scene.scale.height * 0.64)
  const aspect = source.height / source.width
  let frameW = maxW
  let frameH = frameW * aspect

  if (frameH > maxH) {
    frameH = maxH
    frameW = frameH / aspect
  }

  return { frameW, frameH }
}

function ensureMenuFrame(scene: Phaser.Scene) {
  const texture = scene.textures.get(MENU_FRAME_KEY)
  if (!texture.has(MENU_FRAME_BOUNDS.frame)) {
    texture.add(
      MENU_FRAME_BOUNDS.frame,
      0,
      MENU_FRAME_BOUNDS.x,
      MENU_FRAME_BOUNDS.y,
      MENU_FRAME_BOUNDS.width,
      MENU_FRAME_BOUNDS.height,
    )
  }
}

function ensureButtonVisibleFrames(scene: Phaser.Scene) {
  ;([SETTINGS_BUTTON_KEY, EXIT_BUTTON_KEY] as const).forEach(key => {
    const visible = BUTTON_VISIBLE_FRAMES[key]
    const texture = scene.textures.get(key)
    if (!texture.has(visible.frame)) {
      texture.add(visible.frame, 0, visible.x, visible.y, visible.width, visible.height)
    }
  })
}

function ensureSettingFrameSlices(scene: Phaser.Scene) {
  const texture = scene.textures.get(SETTING_FRAME_KEY)
  const { source, topHeight, middleHeight, bottomHeight } = SETTING_FRAME_SLICES

  if (!texture.has(SETTING_FRAME_SLICES.top)) {
    texture.add(SETTING_FRAME_SLICES.top, 0, source.x, source.y, source.width, topHeight)
  }
  if (!texture.has(SETTING_FRAME_SLICES.middle)) {
    texture.add(
      SETTING_FRAME_SLICES.middle,
      0,
      source.x,
      source.y + topHeight,
      source.width,
      middleHeight,
    )
  }
  if (!texture.has(SETTING_FRAME_SLICES.bottom)) {
    texture.add(
      SETTING_FRAME_SLICES.bottom,
      0,
      source.x,
      source.y + source.height - bottomHeight,
      source.width,
      bottomHeight,
    )
  }
}

function createMenuFrame(scene: Phaser.Scene, x: number, y: number, width: number, height: number) {
  return scene.add.image(x, y, MENU_FRAME_KEY, MENU_FRAME_VISIBLE).setDisplaySize(width, height)
}

function createSettingFrame(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const { source, topHeight, bottomHeight } = SETTING_FRAME_SLICES
  const scale = width / source.width
  const topDisplayH = topHeight * scale
  const bottomDisplayH = bottomHeight * scale
  const seamOverlap = Math.max(1, Math.round(2 * scale))
  const middleDisplayH = Math.max(1, height - topDisplayH - bottomDisplayH + seamOverlap * 2)
  const topY = y - height / 2
  const middleY = topY + topDisplayH - seamOverlap
  const bottomY = y + height / 2 - bottomDisplayH

  const top = scene.add
    .image(x, topY, SETTING_FRAME_KEY, SETTING_FRAME_SLICES.top)
    .setOrigin(0.5, 0)
    .setDisplaySize(width, topDisplayH)
  const middle = scene.add
    .image(x, middleY, SETTING_FRAME_KEY, SETTING_FRAME_SLICES.middle)
    .setOrigin(0.5, 0)
    .setDisplaySize(width, middleDisplayH)
  const bottom = scene.add
    .image(x, bottomY, SETTING_FRAME_KEY, SETTING_FRAME_SLICES.bottom)
    .setOrigin(0.5, 0)
    .setDisplaySize(width, bottomDisplayH)

  return scene.add.container(0, 0, [top, middle, bottom])
}

function createImageButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  key: string,
  frame: string,
  width: number,
  height: number,
  onClick: () => void,
) {
  const container = scene.add.container(x, y)
  const image = scene.add.image(0, 0, key, frame).setDisplaySize(width, height)
  const hit = scene.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({
    useHandCursor: true,
  })

  hit.on('pointerover', () => container.setScale(1.03))
  hit.on('pointerout', () => container.setScale(1))
  hit.on(
    'pointerdown',
    (
      _pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation()
      onClick()
    },
  )

  container.add([image, hit])
  return container
}

function createSlider(
  scene: Phaser.Scene,
  {
    x,
    y,
    labelWidth,
    sliderWidth,
    label,
    value,
    onChange,
  }: {
    x: number
    y: number
    labelWidth: number
    sliderWidth: number
    label: string
    value: number
    onChange: (value: number) => void
  },
) {
  const width = sliderWidth
  const container = scene.add.container(0, 0)
  const labelText = scene.add
    .text(x, y, label, {
      fontFamily: 'sans-serif',
      fontSize: '19px',
      color: '#5c3213',
      fontStyle: 'bold',
    })
    .setOrigin(0, 0.5)
  const trackX = x + labelWidth
  const track = scene.add.rectangle(trackX, y, width, 8, 0x9a6834, 1).setOrigin(0, 0.5)
  const fill = scene.add.rectangle(trackX, y, width * value, 8, 0xd8842a, 1).setOrigin(0, 0.5)
  const knob = scene.add.circle(trackX + width * value, y, 11, 0xfff0bf)
  const valueText = scene.add
    .text(trackX + width + 34, y, `${Math.round(value * 100)}`, {
      fontFamily: 'sans-serif',
      fontSize: '17px',
      color: '#5c3213',
      fontStyle: 'bold',
    })
    .setOrigin(0.5)

  const hit = scene.add
    .rectangle(trackX + width / 2, y, width + 30, 34, 0xffffff, 0)
    .setInteractive({
      draggable: true,
      useHandCursor: true,
    })
  const setValue = (pointerX: number) => {
    const next = Phaser.Math.Clamp((pointerX - trackX) / width, 0, 1)
    fill.width = width * next
    knob.x = trackX + width * next
    valueText.setText(`${Math.round(next * 100)}`)
    onChange(next)
  }
  hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => setValue(pointer.x))
  hit.on('drag', (pointer: Phaser.Input.Pointer) => setValue(pointer.x))

  container.add([labelText, track, fill, knob, valueText, hit])
  return {
    container,
    x: trackX + width / 2,
    y,
    width: width + 30,
    height: 34,
    setValue,
  }
}

function isPointInZone(
  x: number,
  y: number,
  zone: { x: number; y: number; width: number; height: number },
) {
  return (
    x >= zone.x - zone.width / 2 &&
    x <= zone.x + zone.width / 2 &&
    y >= zone.y - zone.height / 2 &&
    y <= zone.y + zone.height / 2
  )
}

function applyMasterVolume(scene: Phaser.Scene, value: number) {
  scene.sound.volume = Phaser.Math.Clamp(value, 0, 1)
}

function createSmallButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  onClick: () => void,
  {
    fillColor = 0x6f4521,
    borderColor = 0xf6d28a,
  }: {
    fillColor?: number
    borderColor?: number
  } = {},
) {
  const container = scene.add.container(x, y)
  const bg = scene.add.graphics()
  drawButtonBg(bg, width, height, fillColor, borderColor)
  const text = scene.add
    .text(0, 0, label, {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#fff4d4',
      fontStyle: 'bold',
      stroke: '#4b250c',
      strokeThickness: 2,
    })
    .setOrigin(0.5)
  const hit = scene.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({
    useHandCursor: true,
  })
  hit.on(
    'pointerdown',
    (
      _pointer: Phaser.Input.Pointer,
      _x: number,
      _y: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation()
      onClick()
    },
  )
  container.add([bg, text, hit])
  return container
}

function drawButtonBg(
  graphics: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
  fillColor: number,
  borderColor: number,
) {
  graphics.fillStyle(0x241106, 0.24)
  graphics.fillRoundedRect(-width / 2, -height / 2 + 4, width, height, 12)
  graphics.fillStyle(fillColor, 1)
  graphics.fillRoundedRect(-width / 2, -height / 2, width, height, 12)
  graphics.lineStyle(2, borderColor, 1)
  graphics.strokeRoundedRect(-width / 2, -height / 2, width, height, 12)
}
