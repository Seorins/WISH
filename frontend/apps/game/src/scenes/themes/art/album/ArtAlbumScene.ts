import Phaser from 'phaser'
import {
  deleteArtwork as requestDeleteArtwork,
  getArtwork,
  getMyArtworks,
  type Artwork,
  type ArtworkPage,
} from '@wish/api-client'
import { createArtConfirmDialog, type ArtConfirmDialog } from '../ui/artConfirmDialog'
import { coloringOptions } from '../coloring/coloringOptions'

const ALBUM_PAGE_SIZE = 4
const ARTWORKS_SORT = 'createdAt,desc'
const ALBUM_DEPTH = 40

type ArtworkSlot = {
  x: number
  y: number
  width: number
  height: number
}

export class ArtAlbumScene extends Phaser.Scene {
  private albumLayer: Phaser.GameObjects.Container | null = null
  private contentLayer: Phaser.GameObjects.Container | null = null
  private previousPageZone: Phaser.GameObjects.Zone | null = null
  private nextPageZone: Phaser.GameObjects.Zone | null = null
  private previousPageHint: Phaser.GameObjects.Text | null = null
  private nextPageHint: Phaser.GameObjects.Text | null = null
  private pageText: Phaser.GameObjects.Text | null = null
  private detailLayer: Phaser.GameObjects.Container | null = null
  private deleteConfirmDialog: ArtConfirmDialog | null = null
  private albumPageBounds = new Phaser.Geom.Rectangle()
  private artworkPage: ArtworkPage | null = null
  private currentPage = 0
  private isLoadingPage = false
  private isLoadingArtworkDetail = false
  private isDeletingArtwork = false
  private isPageTurning = false
  private pageTurnTimers: Phaser.Time.TimerEvent[] = []
  private artworkImageObjectUrls: string[] = []

  private readonly handleEscDown = () => {
    if (this.detailLayer) {
      this.closeArtworkDetail()
      return
    }

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
    this.loadImageIfMissing('art-ui-edit-action', '/assets/images/themes/art/ui/edit.png')
    this.loadImageIfMissing('art-ui-delete-action', '/assets/images/themes/art/ui/delete.png')
  }

  create() {
    this.isPageTurning = false
    this.isLoadingPage = false
    this.currentPage = 0
    this.artworkPage = null
    this.clearPageTurnTimers()

    const { width: vw, height: vh } = this.scale
    const dim = this.add
      .rectangle(vw / 2, vh / 2, vw, vh, 0x000000, 1)
      .setDepth(ALBUM_DEPTH)
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
      .setDepth(ALBUM_DEPTH + 1)
      .setDisplaySize(albumPageWidth, albumPageHeight)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0)
    const albumPageScale = { x: albumPage.scaleX, y: albumPage.scaleY }
    albumPage.setScale(albumPageScale.x * 0.98, albumPageScale.y * 0.98)
    this.albumPageBounds.setTo(
      vw / 2 - albumPageWidth / 2,
      vh / 2 - albumPageHeight / 2,
      albumPageWidth,
      albumPageHeight,
    )

    const pageTurnFrame = this.add
      .image(vw / 2, vh / 2, 'art-ui-album-next1')
      .setDepth(ALBUM_DEPTH + 2)
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
      .setDepth(ALBUM_DEPTH + 4)
      .setScrollFactor(0)
    const nextPageZone = this.add
      .zone(vw / 2 + albumPageWidth * 0.28, vh / 2, pageTurnZoneWidth, pageTurnZoneHeight)
      .setDepth(ALBUM_DEPTH + 4)
      .setScrollFactor(0)
    this.previousPageZone = previousPageZone
    this.nextPageZone = nextPageZone

    this.previousPageHint = this.add
      .text(this.albumPageBounds.left + albumPageWidth * 0.055, vh / 2, '‹', {
        fontFamily: 'serif',
        fontSize: `${Math.round(albumPageHeight * 0.09)}px`,
        color: '#8d6031',
      })
      .setDepth(ALBUM_DEPTH + 5)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setAlpha(0)
    this.nextPageHint = this.add
      .text(this.albumPageBounds.right - albumPageWidth * 0.055, vh / 2, '›', {
        fontFamily: 'serif',
        fontSize: `${Math.round(albumPageHeight * 0.09)}px`,
        color: '#8d6031',
      })
      .setDepth(ALBUM_DEPTH + 5)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setAlpha(0)
    this.pageText = this.add
      .text(vw / 2, this.albumPageBounds.bottom - albumPageHeight * 0.105, '', {
        fontFamily: 'sans-serif',
        fontSize: `${Math.max(15, Math.round(albumPageHeight * 0.025))}px`,
        color: '#7a5630',
      })
      .setDepth(ALBUM_DEPTH + 5)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setAlpha(0)

    previousPageZone.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _x: number,
        _y: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation()
        this.requestPageTurn(pageTurnFrame, albumPageWidth, albumPageHeight, 'previous')
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
        this.requestPageTurn(pageTurnFrame, albumPageWidth, albumPageHeight, 'next')
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
      .setDepth(ALBUM_DEPTH + 6)
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
      .container(0, 0, [
        dim,
        albumPage,
        pageTurnFrame,
        previousPageZone,
        nextPageZone,
        closeButton,
        this.previousPageHint,
        this.nextPageHint,
        this.pageText,
      ])
      .setDepth(ALBUM_DEPTH)
    this.contentLayer = this.add
      .container(0, 0)
      .setDepth(ALBUM_DEPTH + 3)
      .setScrollFactor(0)

    this.input.keyboard?.on('keydown-ESC', this.handleEscDown)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-ESC', this.handleEscDown)
      this.tweens.killTweensOf(this.albumLayer?.list ?? [])
      this.tweens.killTweensOf(this.contentLayer?.list ?? [])
      this.tweens.killTweensOf(this.detailLayer?.list ?? [])
      this.clearPageTurnTimers()
      this.revokeArtworkImageObjectUrls()
      this.hideDeleteArtworkConfirm()
      this.detailLayer?.destroy(true)
      this.albumLayer = null
      this.contentLayer = null
      this.detailLayer = null
      this.previousPageZone = null
      this.nextPageZone = null
      this.previousPageHint = null
      this.nextPageHint = null
      this.pageText = null
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
    this.renderStatus('작품을 불러오는 중...')
    this.updatePageControls()
    void this.loadArtworkPage(0)
  }

  private loadImageIfMissing(key: string, url: string) {
    if (!this.textures.exists(key)) {
      this.load.image(key, url)
    }
  }

  private requestPageTurn(
    pageTurnFrame: Phaser.GameObjects.Image,
    albumPageWidth: number,
    albumPageHeight: number,
    direction: 'next' | 'previous',
  ) {
    if (this.isLoadingPage || this.isPageTurning) {
      return
    }

    const targetPage = direction === 'next' ? this.currentPage + 1 : this.currentPage - 1
    if (targetPage < 0) {
      return
    }

    if (direction === 'next' && this.artworkPage?.last) {
      return
    }

    if (direction === 'previous' && this.artworkPage?.first) {
      return
    }

    this.turnPage(pageTurnFrame, albumPageWidth, albumPageHeight, direction)
    void this.loadArtworkPage(targetPage)
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

  private async loadArtworkPage(page: number) {
    if (this.isLoadingPage) {
      return
    }

    this.isLoadingPage = true
    this.currentPage = Math.max(0, page)
    this.renderStatus('작품을 불러오는 중...')
    this.updatePageControls()

    try {
      const response = await getMyArtworks({
        page: this.currentPage,
        size: ALBUM_PAGE_SIZE,
        sort: ARTWORKS_SORT,
      })

      if (!this.scene.isActive('ArtAlbumScene')) {
        return
      }

      this.artworkPage = response.data
      this.currentPage = response.data.number
      await this.loadArtworkImages(response.data.content)

      if (!this.scene.isActive('ArtAlbumScene')) {
        return
      }

      this.renderArtworkPage(response.data.content)
    } catch (error) {
      console.error('Failed to load my artworks.', error)
      this.artworkPage = null
      this.renderStatus('작품을 불러오지 못했어요.')
    } finally {
      this.isLoadingPage = false
      this.updatePageControls()
    }
  }

  private async loadArtworkImages(artworks: Artwork[]) {
    const missingArtworks = artworks.filter(
      artwork => artwork.imageUrl && !this.textures.exists(this.getArtworkTextureKey(artwork)),
    )

    if (!missingArtworks.length) {
      return
    }

    const imageSources = (
      await Promise.all(
        missingArtworks.map(async artwork => {
          try {
            const imageUrl = await this.createArtworkImageObjectUrl(artwork.imageUrl)
            return { key: this.getArtworkTextureKey(artwork), imageUrl }
          } catch (error) {
            console.error('Failed to load artwork image.', error)
            return null
          }
        }),
      )
    ).filter((source): source is { key: string; imageUrl: string } => source !== null)

    if (!imageSources.length) {
      return
    }

    await new Promise<void>(resolve => {
      this.load.once('complete', () => resolve())
      imageSources.forEach(({ key, imageUrl }) => {
        this.load.image(key, imageUrl)
      })
      this.load.start()
    })
  }

  private renderArtworkPage(artworks: Artwork[]) {
    if (!this.contentLayer) {
      return
    }

    this.contentLayer.removeAll(true)

    if (!artworks.length) {
      this.renderStatus('아직 저장한 작품이 없어요.')
      return
    }

    const slots = this.getArtworkSlots()
    artworks.slice(0, ALBUM_PAGE_SIZE).forEach((artwork, index) => {
      const slot = slots[index]
      if (!slot) {
        return
      }

      this.createArtworkImage(artwork, slot)
    })

    this.contentLayer.setAlpha(0)
    this.tweens.add({
      targets: this.contentLayer,
      alpha: 1,
      duration: 140,
      ease: 'Sine.easeOut',
    })
  }

  private renderStatus(message: string) {
    if (!this.contentLayer) {
      return
    }

    this.contentLayer.removeAll(true)
    const fontSize = Math.max(20, Math.round(this.albumPageBounds.height * 0.034))
    const text = this.add
      .text(this.albumPageBounds.centerX, this.albumPageBounds.centerY, message, {
        fontFamily: 'sans-serif',
        fontSize: `${fontSize}px`,
        color: '#7a5630',
        align: 'center',
        wordWrap: { width: this.albumPageBounds.width * 0.62, useAdvancedWrap: true },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
    this.contentLayer.add(text)
  }

  private createArtworkImage(artwork: Artwork, slot: ArtworkSlot) {
    const layer = this.contentLayer
    if (!layer) {
      return
    }

    const imageBox = {
      x: slot.x,
      y: slot.y,
      width: slot.width,
      height: slot.height,
    }
    const textureKey = this.getArtworkTextureKey(artwork)

    if (!this.textures.exists(textureKey)) {
      return
    }

    const image = this.add
      .image(imageBox.x + imageBox.width / 2, imageBox.y + imageBox.height / 2, textureKey)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
    const source = image.texture.getSourceImage() as HTMLImageElement
    const scale = Math.min(imageBox.width / source.width, imageBox.height / source.height)
    image.setDisplaySize(source.width * scale, source.height * scale)
    image.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _x: number,
        _y: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation()
        void this.openArtworkDetail(artwork.id)
      },
    )
    layer.add(image)
  }

  private async openArtworkDetail(artworkId: number) {
    if (this.isLoadingArtworkDetail) {
      return
    }

    this.isLoadingArtworkDetail = true

    try {
      const response = await getArtwork(artworkId)

      if (!this.scene.isActive('ArtAlbumScene')) {
        return
      }

      await this.loadArtworkImages([response.data])

      if (!this.scene.isActive('ArtAlbumScene')) {
        return
      }

      this.renderArtworkDetail(response.data)
    } catch (error) {
      console.error('Failed to load artwork detail.', error)
    } finally {
      this.isLoadingArtworkDetail = false
    }
  }

  private renderArtworkDetail(artwork: Artwork) {
    const textureKey = this.getArtworkTextureKey(artwork)
    if (!this.textures.exists(textureKey)) {
      return
    }

    this.closeArtworkDetail()

    const { width, height } = this.scale
    const dim = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.62)
      .setScrollFactor(0)
      .setAlpha(0)
      .setInteractive()
    const image = this.add
      .image(width / 2, height / 2, textureKey)
      .setScrollFactor(0)
      .setAlpha(0)
      .setInteractive({ useHandCursor: true })
    const source = image.texture.getSourceImage() as HTMLImageElement
    const maxWidth = width * 0.78
    const maxHeight = height * 0.68
    const scale = Math.min(maxWidth / source.width, maxHeight / source.height)
    image.setDisplaySize(source.width * scale, source.height * scale)
    const buttonHeight = Math.min(76, Math.max(56, Math.round(height * 0.065)))
    const buttonGap = Math.max(12, Math.round(buttonHeight * 0.25))
    const editButtonWidth = this.getTextureDisplayWidth('art-ui-edit-action', buttonHeight)
    const deleteButtonWidth = this.getTextureDisplayWidth('art-ui-delete-action', buttonHeight)
    const buttonsTotalWidth = editButtonWidth + deleteButtonWidth + buttonGap
    const buttonsY = Math.min(
      height - buttonHeight / 2 - 28,
      image.y + image.displayHeight / 2 + buttonHeight * 0.78,
    )
    const editButton = this.createDetailActionButton(
      width / 2 - buttonsTotalWidth / 2 + editButtonWidth / 2,
      buttonsY,
      buttonHeight,
      'art-ui-edit-action',
      () => this.startArtworkEdit(artwork),
    )
    const deleteButton = this.createDetailActionButton(
      width / 2 + buttonsTotalWidth / 2 - deleteButtonWidth / 2,
      buttonsY,
      buttonHeight,
      'art-ui-delete-action',
      () => this.showDeleteArtworkConfirm(artwork),
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
        this.closeArtworkDetail()
      },
    )
    image.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _x: number,
        _y: number,
        event: Phaser.Types.Input.EventData,
      ) => event.stopPropagation(),
    )

    this.detailLayer = this.add
      .container(0, 0, [dim, image, editButton, deleteButton])
      .setDepth(ALBUM_DEPTH + 20)
      .setScrollFactor(0)
    this.tweens.add({
      targets: [dim, image, editButton, deleteButton],
      alpha: 1,
      duration: 140,
      ease: 'Sine.easeOut',
    })
  }

  private closeArtworkDetail() {
    this.hideDeleteArtworkConfirm()
    this.detailLayer?.destroy(true)
    this.detailLayer = null
  }

  private createDetailActionButton(
    x: number,
    y: number,
    height: number,
    textureKey: string,
    onSelect: () => void,
  ) {
    const button = this.add
      .image(x, y, textureKey)
      .setScrollFactor(0)
      .setDisplaySize(this.getTextureDisplayWidth(textureKey, height), height)
      .setAlpha(0)
      .setInteractive({ useHandCursor: true })
    const baseScale = { x: button.scaleX, y: button.scaleY }
    const handlePointerDown = (
      _pointer: Phaser.Input.Pointer,
      _x: number,
      _y: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation()
      onSelect()
    }

    button.on('pointerover', () => {
      button.setTint(0xfff1c2)
      button.setScale(baseScale.x * 1.04, baseScale.y * 1.04)
    })
    button.on('pointerout', () => {
      button.clearTint()
      button.setScale(baseScale.x, baseScale.y)
    })
    button.on('pointerdown', handlePointerDown)
    return button
  }

  private getTextureDisplayWidth(textureKey: string, height: number) {
    const source = this.textures.get(textureKey).getSourceImage() as HTMLImageElement
    return Math.round(height * (source.width / source.height))
  }

  private showDeleteArtworkConfirm(artwork: Artwork) {
    if (this.deleteConfirmDialog || this.isDeletingArtwork) {
      return
    }

    this.deleteConfirmDialog = createArtConfirmDialog(this, {
      depth: ALBUM_DEPTH + 40,
      title: '작품을 삭제할까요?',
      message: '삭제하면 다시 되돌릴 수 없어요.',
      secondaryButton: {
        label: '취소',
        fillColor: 0xfff6e8,
        strokeColor: 0xb78b61,
        textColor: '#5f3b22',
        onSelect: () => this.hideDeleteArtworkConfirm(),
      },
      primaryButton: {
        label: '삭제하기',
        fillColor: 0xd94b3d,
        strokeColor: 0x9f2f26,
        textColor: '#ffffff',
        onSelect: () => {
          this.hideDeleteArtworkConfirm()
          void this.deleteArtwork(artwork.id)
        },
      },
    })
  }

  private hideDeleteArtworkConfirm() {
    this.deleteConfirmDialog?.destroy()
    this.deleteConfirmDialog = null
  }

  private async deleteArtwork(artworkId: number) {
    if (this.isDeletingArtwork) {
      return
    }

    this.isDeletingArtwork = true

    try {
      await requestDeleteArtwork(artworkId)

      if (!this.scene.isActive('ArtAlbumScene')) {
        return
      }

      const targetPage =
        this.currentPage > 0 && (this.artworkPage?.numberOfElements ?? 0) <= 1
          ? this.currentPage - 1
          : this.currentPage
      this.closeArtworkDetail()
      await this.loadArtworkPage(targetPage)
    } catch (error) {
      console.error('Failed to delete artwork.', error)
    } finally {
      this.isDeletingArtwork = false
    }
  }

  private startArtworkEdit(artwork: Artwork) {
    const imageTextureKey = this.getArtworkTextureKey(artwork)
    if (!this.textures.exists(imageTextureKey)) {
      return
    }

    const editArtwork = {
      id: artwork.id,
      imageTextureKey,
      isPublic: artwork.isPublic,
    }

    this.closeArtworkDetail()

    if (this.isFreeDrawingArtwork(artwork)) {
      this.scene.start('ArtFreeDrawingScene', {
        suppressIntroDialog: true,
        editArtwork,
      })
      this.scene.stop('ArtSelectScene')
      return
    }

    this.scene.start('ArtColoringScene', {
      coloringId: this.getColoringIdForArtwork(artwork),
      suppressIntroDialog: true,
      editArtwork,
    })
    this.scene.stop('ArtSelectScene')
  }

  private isFreeDrawingArtwork(artwork: Artwork) {
    return (
      artwork.sketchCode === null || artwork.sketchCode === undefined || artwork.sketchCode === ''
    )
  }

  private getColoringIdForArtwork(artwork: Artwork) {
    const sketchNumber = Number(artwork.sketchCode)
    const optionIndex = Number.isFinite(sketchNumber) ? Math.max(0, sketchNumber - 1) : 0
    return coloringOptions[optionIndex]?.id ?? coloringOptions[0].id
  }

  private getArtworkSlots(): ArtworkSlot[] {
    const bounds = this.albumPageBounds
    const pageTop = bounds.top + bounds.height * 0.18
    const pageHeight = bounds.height * 0.64
    const pageWidth = bounds.width * 0.39
    const leftX = bounds.left + bounds.width * 0.08
    const rightX = bounds.left + bounds.width * 0.53
    const cardGap = bounds.height * 0.035
    const cardHeight = (pageHeight - cardGap) / 2

    return [
      { x: leftX, y: pageTop, width: pageWidth, height: cardHeight },
      { x: leftX, y: pageTop + cardHeight + cardGap, width: pageWidth, height: cardHeight },
      { x: rightX, y: pageTop, width: pageWidth, height: cardHeight },
      { x: rightX, y: pageTop + cardHeight + cardGap, width: pageWidth, height: cardHeight },
    ]
  }

  private updatePageControls() {
    const canGoPrevious =
      !this.isLoadingPage && Boolean(this.artworkPage && !this.artworkPage.first)
    const canGoNext = !this.isLoadingPage && Boolean(this.artworkPage && !this.artworkPage.last)

    if (canGoPrevious) {
      this.previousPageZone?.setInteractive({ useHandCursor: true })
    } else {
      this.previousPageZone?.disableInteractive()
    }

    if (canGoNext) {
      this.nextPageZone?.setInteractive({ useHandCursor: true })
    } else {
      this.nextPageZone?.disableInteractive()
    }

    this.previousPageHint?.setAlpha(canGoPrevious ? 0.85 : 0.22)
    this.nextPageHint?.setAlpha(canGoNext ? 0.85 : 0.22)

    if (!this.pageText) {
      return
    }

    if (!this.artworkPage || this.artworkPage.totalPages <= 0) {
      this.pageText.setText('')
      this.pageText.setAlpha(0)
      return
    }

    this.pageText.setText(`${this.artworkPage.number + 1} / ${this.artworkPage.totalPages}`)
    this.pageText.setAlpha(0.9)
  }

  private async createArtworkImageObjectUrl(imageUrl: string) {
    const response = await fetch(this.resolveArtworkImageUrl(imageUrl), {
      headers: this.getArtworkImageRequestHeaders(),
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch artwork image: ${response.status}`)
    }

    const objectUrl = URL.createObjectURL(await response.blob())
    this.artworkImageObjectUrls.push(objectUrl)
    return objectUrl
  }

  private getArtworkImageRequestHeaders(): HeadersInit {
    const accessToken = localStorage.getItem('wish_access_token')
    if (!accessToken) {
      return {}
    }

    return { Authorization: `Bearer ${accessToken}` }
  }

  private revokeArtworkImageObjectUrls() {
    this.artworkImageObjectUrls.forEach(objectUrl => URL.revokeObjectURL(objectUrl))
    this.artworkImageObjectUrls = []
  }

  private getArtworkTextureKey(artwork: Artwork) {
    const version = artwork.updatedAt.replace(/[^a-zA-Z0-9_-]/g, '_')
    return `art-album-artwork-${artwork.id}-${version}`
  }

  private resolveArtworkImageUrl(imageUrl: string) {
    const trimmedImageUrl = imageUrl.trim()
    if (/^(https?:|data:|blob:)/i.test(trimmedImageUrl)) {
      return trimmedImageUrl
    }

    const apiBaseUrl = this.getApiBaseUrl()
    const apiBasePath = apiBaseUrl.pathname.replace(/\/$/, '')

    if (trimmedImageUrl.startsWith('/')) {
      if (trimmedImageUrl === apiBasePath || trimmedImageUrl.startsWith(`${apiBasePath}/`)) {
        return new URL(trimmedImageUrl, apiBaseUrl.origin).toString()
      }

      if (/^\/api\/v1(\/|$)/.test(trimmedImageUrl)) {
        return new URL(
          `${this.getApiDeploymentPath(apiBaseUrl)}${trimmedImageUrl}`,
          apiBaseUrl.origin,
        ).toString()
      }

      return new URL(`${apiBasePath}${trimmedImageUrl}`, apiBaseUrl.origin).toString()
    }

    return new URL(trimmedImageUrl, apiBaseUrl).toString()
  }

  private getApiDeploymentPath(apiBaseUrl: URL) {
    const normalizedPath = apiBaseUrl.pathname.replace(/\/$/, '')
    const apiVersionPath = '/api/v1'
    if (!normalizedPath.endsWith(apiVersionPath)) {
      return normalizedPath
    }

    return normalizedPath.slice(0, -apiVersionPath.length)
  }

  private getApiBaseUrl() {
    const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL
    if (!configuredBaseUrl) {
      return new URL(window.location.origin)
    }

    if (/^https?:\/\//i.test(configuredBaseUrl)) {
      return new URL(configuredBaseUrl.endsWith('/') ? configuredBaseUrl : `${configuredBaseUrl}/`)
    }

    const basePath = configuredBaseUrl.startsWith('/') ? configuredBaseUrl : `/${configuredBaseUrl}`
    return new URL(basePath.endsWith('/') ? basePath : `${basePath}/`, window.location.origin)
  }
}
