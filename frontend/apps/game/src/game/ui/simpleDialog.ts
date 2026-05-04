import Phaser from 'phaser'

export type SimpleDialogTextBox = {
  x: number
  y: number
  width: number
  height: number
}

type CreateSimpleDialogOptions = {
  frameKey: string
  textBox: SimpleDialogTextBox
  dialogWidthRatio?: number
  maxDialogWidth?: number
  frameDepth?: number
  textDepth?: number
  fontColor?: string
  fontSize?: number
  lineSpacing?: number
  frameBottomMargin?: number
  nameBox?: SimpleDialogTextBox
  nameText?: string
  nameFontColor?: string
  nameFontSize?: number
  nameLetterSpacing?: number
  /**
   * Per-line optical offsets applied by `setCenteredDialogText` (subtracted from
   * the centered Y). Tuned per dialog frame asset.
   */
  opticalOffsets?: { single?: number; double?: number; multi?: number }
}

export type SimpleDialogUi = {
  frame: Phaser.GameObjects.Image
  text: Phaser.GameObjects.Text
  textBaseX: number
  textBaseY: number
  textBoxHeight: number
  scale: number
  nameLabel?: Phaser.GameObjects.Text
  opticalOffsets: { single: number; double: number; multi: number }
}

export function createSimpleDialogUi(
  scene: Phaser.Scene,
  {
    frameKey,
    textBox,
    dialogWidthRatio = 0.75,
    maxDialogWidth = 860,
    frameDepth = 20,
    textDepth = 21,
    fontColor = '#3b2a1f',
    fontSize = 44,
    lineSpacing = 6,
    frameBottomMargin = -30,
    nameBox,
    nameText,
    nameFontColor = '#fff8ec',
    nameFontSize = 32,
    nameLetterSpacing = 0,
    opticalOffsets,
  }: CreateSimpleDialogOptions,
) {
  const resolvedOffsets = {
    single: opticalOffsets?.single ?? 34,
    double: opticalOffsets?.double ?? 28,
    multi: opticalOffsets?.multi ?? 8,
  }
  const { width: vw, height: vh } = scene.scale
  const dialogWidth = Math.min(vw * dialogWidthRatio, maxDialogWidth)
  const frame = scene.add.image(vw / 2, vh - 80, frameKey)
  const source = frame.texture.getSourceImage() as HTMLImageElement
  frame.setDisplaySize(dialogWidth, dialogWidth * (source.height / source.width))
  frame.setDepth(frameDepth).setAlpha(0).setScrollFactor(0)
  frame.y = vh - frameBottomMargin - frame.displayHeight / 2

  const scale = frame.displayWidth / source.width
  const dialogLeft = frame.x - frame.displayWidth / 2
  const dialogTop = frame.y - frame.displayHeight / 2
  const textBaseX = dialogLeft + textBox.x * scale
  const textBaseY = dialogTop + textBox.y * scale
  const textBoxHeight = textBox.height * scale
  const text = scene.add.text(textBaseX, textBaseY, '', {
    fontFamily: 'sans-serif',
    fontSize: `${Math.round(fontSize * scale)}px`,
    color: fontColor,
    wordWrap: { width: textBox.width * scale, useAdvancedWrap: true },
    lineSpacing: Math.round(lineSpacing * scale),
  })
  text.setDepth(textDepth).setAlpha(0).setScrollFactor(0).setOrigin(0, 0)

  let nameLabel: Phaser.GameObjects.Text | undefined
  if (nameBox && nameText) {
    const nameCenterX = dialogLeft + (nameBox.x + nameBox.width / 2) * scale
    const nameCenterY = dialogTop + (nameBox.y + nameBox.height / 2) * scale
    nameLabel = scene.add.text(nameCenterX, nameCenterY, nameText, {
      fontFamily: '"Pretendard", "Noto Sans KR", "Malgun Gothic", sans-serif',
      fontSize: `${Math.round(nameFontSize * scale)}px`,
      fontStyle: 'bold',
      color: nameFontColor,
    })
    nameLabel
      .setOrigin(0.5)
      .setDepth(textDepth)
      .setAlpha(0)
      .setScrollFactor(0)
      .setLetterSpacing(nameLetterSpacing * scale)
  }

  return {
    frame,
    text,
    textBaseX,
    textBaseY,
    textBoxHeight,
    scale,
    nameLabel,
    opticalOffsets: resolvedOffsets,
  }
}

export function setCenteredDialogText(dialog: SimpleDialogUi, line: string) {
  dialog.text.setText(line)
  const lineCount = dialog.text.getWrappedText(dialog.text.text).length
  const offsets = dialog.opticalOffsets
  const opticalOffsetUnits =
    lineCount <= 1 ? offsets.single : lineCount === 2 ? offsets.double : offsets.multi
  const centeredY =
    dialog.textBaseY +
    Math.max(0, (dialog.textBoxHeight - dialog.text.height) / 2) -
    opticalOffsetUnits * dialog.scale

  dialog.text.setPosition(dialog.textBaseX, centeredY)
}

export function setDialogTextAtBase(dialog: SimpleDialogUi, line: string) {
  dialog.text.setText(line)
  dialog.text.setPosition(dialog.textBaseX, dialog.textBaseY)
}

export function fadeSimpleDialog(
  scene: Phaser.Scene,
  dialog: SimpleDialogUi,
  alpha: number,
  duration: number,
) {
  const targets: Phaser.GameObjects.GameObject[] = [dialog.frame, dialog.text]
  if (dialog.nameLabel) targets.push(dialog.nameLabel)
  scene.tweens.killTweensOf(targets)
  scene.tweens.add({
    targets,
    alpha,
    duration,
    ease: alpha > 0 ? 'Sine.easeOut' : 'Sine.easeIn',
  })
}
