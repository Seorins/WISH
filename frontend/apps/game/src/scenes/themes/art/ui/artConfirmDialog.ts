import Phaser from 'phaser'

type ArtConfirmButtonOptions = {
  label: string
  fillColor: number
  strokeColor: number
  textColor: string
  onSelect: () => void
}

type ArtConfirmDialogOptions = {
  depth: number
  title: string
  message: string
  secondaryButton: ArtConfirmButtonOptions
  primaryButton: ArtConfirmButtonOptions
}

export type ArtConfirmDialog = {
  destroy: () => void
}

export function createArtConfirmDialog(
  scene: Phaser.Scene,
  { depth, title, message, secondaryButton, primaryButton }: ArtConfirmDialogOptions,
): ArtConfirmDialog {
  const { width: vw, height: vh } = scene.scale
  const centerX = vw / 2
  const centerY = vh / 2
  const panelWidth = Phaser.Math.Clamp(vw * 0.32, 380, 540)
  const panelHeight = Phaser.Math.Clamp(vh * 0.23, 220, 270)
  const panelX = centerX - panelWidth / 2
  const panelY = centerY - panelHeight / 2
  const objects: Phaser.GameObjects.GameObject[] = []

  const overlay = scene.add
    .rectangle(centerX, centerY, vw, vh, 0x000000, 0.42)
    .setDepth(depth)
    .setInteractive()
  overlay.on(
    'pointerdown',
    (
      _pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => event.stopPropagation(),
  )

  const panel = scene.add.graphics().setDepth(depth + 1)
  panel.fillStyle(0xfff6e8, 0.98)
  panel.lineStyle(4, 0x8f6c48, 1)
  panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 22)
  panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 22)

  const titleText = scene.add
    .text(centerX, panelY + 54, title, {
      fontFamily: 'sans-serif',
      fontSize: `${Math.max(20, Math.round(vw * 0.013))}px`,
      color: '#4e321f',
      align: 'center',
    })
    .setDepth(depth + 2)
    .setOrigin(0.5)

  const messageText = scene.add
    .text(centerX, panelY + 106, message, {
      fontFamily: 'sans-serif',
      fontSize: `${Math.max(15, Math.round(vw * 0.009))}px`,
      color: '#70513a',
      align: 'center',
      wordWrap: { width: panelWidth - 56, useAdvancedWrap: true },
    })
    .setDepth(depth + 2)
    .setOrigin(0.5)

  objects.push(overlay, panel, titleText, messageText)
  createConfirmButton(
    scene,
    objects,
    depth,
    centerX - panelWidth * 0.22,
    panelY + panelHeight - 54,
    Math.min(180, panelWidth * 0.36),
    48,
    secondaryButton,
  )
  createConfirmButton(
    scene,
    objects,
    depth,
    centerX + panelWidth * 0.22,
    panelY + panelHeight - 54,
    Math.min(180, panelWidth * 0.36),
    48,
    primaryButton,
  )

  return {
    destroy: () => {
      objects.forEach(object => object.destroy())
    },
  }
}

function createConfirmButton(
  scene: Phaser.Scene,
  objects: Phaser.GameObjects.GameObject[],
  depth: number,
  x: number,
  y: number,
  width: number,
  height: number,
  { label, fillColor, strokeColor, textColor, onSelect }: ArtConfirmButtonOptions,
) {
  const button = scene.add
    .rectangle(x, y, width, height, fillColor, 1)
    .setDepth(depth + 2)
    .setStrokeStyle(3, strokeColor, 1)
    .setInteractive({ useHandCursor: true })
  const text = scene.add
    .text(x, y, label, {
      fontFamily: 'sans-serif',
      fontSize: `${Math.max(15, Math.round(scene.scale.width * 0.009))}px`,
      color: textColor,
      align: 'center',
    })
    .setDepth(depth + 3)
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
  const handlePointerDown = (
    _pointer: Phaser.Input.Pointer,
    _localX: number,
    _localY: number,
    event: Phaser.Types.Input.EventData,
  ) => {
    event.stopPropagation()
    onSelect()
  }

  button.on('pointerover', () => button.setScale(1.03))
  button.on('pointerout', () => button.setScale(1))
  button.on('pointerdown', handlePointerDown)
  text.on('pointerover', () => button.setScale(1.03))
  text.on('pointerout', () => button.setScale(1))
  text.on('pointerdown', handlePointerDown)
  objects.push(button, text)
}
