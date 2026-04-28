import Phaser from 'phaser'

export class ArtAlbumScene extends Phaser.Scene {
  private albumLayer: Phaser.GameObjects.Container | null = null
  private isPageTurning = false
  private pageTurnTimers: Phaser.Time.TimerEvent[] = []

  private readonly handleEscDown = () => {
    this.closeAlbum()
  }

  constructor() {
    super({ key: 'ArtAlbumScene' })
  }

  preload() {
    this.loadImageIfMissing('art-ui-delete-btn', '/assets/images/themes/art/ui/delete_btn.png')
    this.loadImageIfMissing('art-ui-album-page', '/assets/images/themes/art/ui/album_page.png')
    this.loadImageIfMissing('art-ui-album-next1', '/assets/images/themes/art/ui/album_next1.png')
    this.loadImageIfMissing('art-ui-album-next2', '/assets/images/themes/art/ui/album_next2.png')
  }

  create() {
    this.isPageTurning = false
    this.clearPageTurnTimers()

    const { width: vw, height: vh } = this.scale
    const dim = this.add
      .rectangle(vw / 2, vh / 2, vw, vh, 0x000000, 1)
      .setDepth(40)
      .setScrollFactor(0)
      .setAlpha(0)
      .setInteractive()

    const albumPageSource = this.textures
      .get('art-ui-album-page')
      .getSourceImage() as HTMLImageElement
    const albumPageRatio = albumPageSource.width / albumPageSource.height
    const albumPageHeight = Math.min(vh * 0.96, (vw * 0.94) / albumPageRatio)
    const albumPageWidth = albumPageHeight * albumPageRatio
    const albumPage = this.add
      .image(vw / 2, vh / 2, 'art-ui-album-page')
      .setDepth(41)
      .setDisplaySize(albumPageWidth, albumPageHeight)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0)
    const albumPageScale = { x: albumPage.scaleX, y: albumPage.scaleY }
    albumPage.setScale(albumPageScale.x * 0.98, albumPageScale.y * 0.98)

    const pageTurnFrame = this.add
      .image(vw / 2, vh / 2, 'art-ui-album-next1')
      .setDepth(42)
      .setDisplaySize(albumPageWidth, albumPageHeight)
      .setScrollFactor(0)
      .setAlpha(0)
      .setVisible(false)
    const pageTurnMaskShape = this.make.graphics({}, false)
    const pageTurnMaskLeft = vw / 2 - albumPageWidth * 0.32
    const pageTurnMaskTop = vh / 2 - albumPageHeight * 0.48
    const pageTurnMaskWidth = albumPageWidth * 0.64
    pageTurnMaskShape.fillStyle(0xffffff)
    pageTurnMaskShape.fillRect(
      pageTurnMaskLeft,
      pageTurnMaskTop,
      pageTurnMaskWidth,
      albumPageHeight * 0.72,
    )
    pageTurnMaskShape.fillTriangle(
      pageTurnMaskLeft,
      vh / 2 + albumPageHeight * 0.24,
      pageTurnMaskLeft + pageTurnMaskWidth,
      vh / 2 + albumPageHeight * 0.24,
      vw / 2,
      vh / 2 + albumPageHeight * 0.33,
    )
    pageTurnFrame.setMask(pageTurnMaskShape.createGeometryMask())
    pageTurnFrame.on('destroy', () => pageTurnMaskShape.destroy())

    const pageTurnZoneWidth = albumPageWidth * 0.28
    const pageTurnZoneHeight = albumPageHeight * 0.76
    const previousPageZone = this.add
      .zone(vw / 2 - albumPageWidth * 0.28, vh / 2, pageTurnZoneWidth, pageTurnZoneHeight)
      .setDepth(42)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
    const nextPageZone = this.add
      .zone(vw / 2 + albumPageWidth * 0.28, vh / 2, pageTurnZoneWidth, pageTurnZoneHeight)
      .setDepth(42)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })

    previousPageZone.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _x: number,
        _y: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation()
        this.turnPage(pageTurnFrame, albumPageWidth, albumPageHeight, 'previous')
      },
    )
    nextPageZone.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _x: number,
        _y: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation()
        this.turnPage(pageTurnFrame, albumPageWidth, albumPageHeight, 'next')
      },
    )
    albumPage.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _x: number,
        _y: number,
        event: Phaser.Types.Input.EventData,
      ) => event.stopPropagation(),
    )

    const closeButtonSource = this.textures
      .get('art-ui-delete-btn')
      .getSourceImage() as HTMLImageElement
    const closeButtonSize = Math.min(64, Math.max(46, vh * 0.07))
    const closeButton = this.add
      .image(vw - 32 - closeButtonSize / 2, 32 + closeButtonSize / 2, 'art-ui-delete-btn')
      .setDepth(43)
      .setDisplaySize(
        closeButtonSize,
        closeButtonSize * (closeButtonSource.height / closeButtonSource.width),
      )
      .setScrollFactor(0)
      .setAlpha(0)
      .setInteractive({ useHandCursor: true })
    const closeButtonScale = { x: closeButton.scaleX, y: closeButton.scaleY }
    closeButton.on('pointerover', () => {
      closeButton.setTint(0xfff3c4)
      closeButton.setScale(closeButtonScale.x * 1.06, closeButtonScale.y * 1.06)
    })
    closeButton.on('pointerout', () => {
      closeButton.clearTint()
      closeButton.setScale(closeButtonScale.x, closeButtonScale.y)
    })
    closeButton.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _x: number,
        _y: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation()
        this.closeAlbum()
      },
    )

    dim.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _x: number,
        _y: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation()
        this.closeAlbum()
      },
    )

    this.albumLayer = this.add
      .container(0, 0, [dim, albumPage, pageTurnFrame, previousPageZone, nextPageZone, closeButton])
      .setDepth(40)

    this.input.keyboard?.on('keydown-ESC', this.handleEscDown)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-ESC', this.handleEscDown)
      this.tweens.killTweensOf(this.albumLayer?.list ?? [])
      this.clearPageTurnTimers()
      this.albumLayer = null
    })

    this.tweens.add({
      targets: dim,
      alpha: 0.56,
      duration: 160,
      ease: 'Sine.easeOut',
    })
    this.tweens.add({
      targets: albumPage,
      alpha: 1,
      scaleX: albumPageScale.x,
      scaleY: albumPageScale.y,
      duration: 180,
      ease: 'Sine.easeOut',
    })
    this.tweens.add({
      targets: closeButton,
      alpha: 1,
      duration: 160,
      ease: 'Sine.easeOut',
    })
  }

  private loadImageIfMissing(key: string, url: string) {
    if (!this.textures.exists(key)) {
      this.load.image(key, url)
    }
  }

  private turnPage(
    pageTurnFrame: Phaser.GameObjects.Image,
    albumPageWidth: number,
    albumPageHeight: number,
    direction: 'next' | 'previous',
  ) {
    if (this.isPageTurning) {
      return
    }

    this.isPageTurning = true
    this.clearPageTurnTimers()
    this.isPageTurning = true

    const frameKeys =
      direction === 'next'
        ? ['art-ui-album-next1', 'art-ui-album-next2']
        : ['art-ui-album-next2', 'art-ui-album-next1']

    frameKeys.forEach((frameKey, index) => {
      const timer = this.time.delayedCall(115 * index, () => {
        if (!this.albumLayer || !pageTurnFrame.active) {
          return
        }

        pageTurnFrame
          .setTexture(frameKey)
          .setDisplaySize(albumPageWidth, albumPageHeight)
          .setAlpha(1)
          .setVisible(true)

        if (index === frameKeys.length - 1) {
          const hideTimer = this.time.delayedCall(115, () => {
            if (pageTurnFrame.active) {
              pageTurnFrame.setAlpha(0).setVisible(false)
            }
            this.clearPageTurnTimers()
          })
          this.pageTurnTimers.push(hideTimer)
        }
      })
      this.pageTurnTimers.push(timer)
    })
  }

  private closeAlbum() {
    this.scene.stop('ArtAlbumScene')
  }

  private clearPageTurnTimers() {
    this.pageTurnTimers.forEach(timer => timer.remove(false))
    this.pageTurnTimers = []
    this.isPageTurning = false
  }
}
