import Phaser from 'phaser'

type CoverBackgroundOptions = {
  depth?: number
  scaleMultiplier?: number
}

export function addCoverBackground(
  scene: Phaser.Scene,
  textureKey: string,
  { depth = 0, scaleMultiplier = 1 }: CoverBackgroundOptions = {},
) {
  const { width, height } = scene.scale
  const background = scene.add.image(width / 2, height / 2, textureKey)
  const source = background.texture.getSourceImage() as HTMLImageElement
  const scale = Math.max(width / source.width, height / source.height) * scaleMultiplier
  background.setScale(scale).setDepth(depth)

  return background
}
