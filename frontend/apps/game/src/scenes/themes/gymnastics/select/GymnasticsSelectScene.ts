import Phaser from 'phaser'

const FRAME_SIZE = 313
const SPEED = 180
const GYMNASTICS_ROOM_SPAWN = { xRatio: 0.5, yRatio: 0.76 }
const GYMNASTICS_EXIT_PORTAL = { xRatio: 0.44, yRatio: 0.86, widthRatio: 0.12, heightRatio: 0.12 }
const GYMNASTICS_RETURN_SPAWN = { xRatio: 0.72, yRatio: 0.58 }
const DIALOG_TEXT_BOX = { x: 830, y: 470, width: 780, height: 190 }

const RACCOON_DIALOGS = [
  '안녕! 나는 체조 선생님 성수야!',
  '오늘도 신나게 체조 해볼까?',
  '열심히 하면 누구든 잘 할 수 있어!',
  '같이 운동하면 더 즐거워!',
]

type GymnasticsSelectSceneData = {
  spawn?: { xRatio: number; yRatio: number }
}

export class GymnasticsSelectScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private target: Phaser.Math.Vector2 | null = null
  private lastDirection = 'down'
  private exitPortal!: Phaser.Geom.Rectangle
  private isTransitioning = false
  private playerWasInExitPortal = true

  private raccoon!: Phaser.GameObjects.Image
  private talkIcon!: Phaser.GameObjects.Image
  private dialogBox!: Phaser.GameObjects.Image
  private dialogText!: Phaser.GameObjects.Text
  private dialogTextBaseX = 0
  private dialogTextBaseY = 0
  private dialogTextBoxHeight = 0
  private dialogScale = 1
  private isDialogVisible = false

  constructor() {
    super({ key: 'GymnasticsSelectScene' })
  }

  preload() {
    this.load.image(
      'gymnastics-background',
      '/assets/images/themes/gymnastics/background/background.png',
    )
    this.load.image('raccoon', '/assets/images/themes/gymnastics/characters/Raccoon.png')
    this.load.image('talk-icon', '/assets/images/ui/icons/talk.png')
    this.load.image('talking-icon', '/assets/images/ui/icons/talking.png')
    this.load.image('seongsu-dialog', '/assets/images/npcs/seongsu/dialog-frame.png')
    this.load.spritesheet('character', '/assets/images/common/player/character_sheet.png', {
      frameWidth: FRAME_SIZE,
      frameHeight: FRAME_SIZE,
      margin: 0,
      spacing: 0,
    })
  }

  create(data: GymnasticsSelectSceneData = {}) {
    const { width: vw, height: vh } = this.scale
    this.isTransitioning = false
    this.isDialogVisible = false
    this.target = null

    const background = this.add.image(vw / 2, vh / 2, 'gymnastics-background')
    const source = background.texture.getSourceImage() as HTMLImageElement
    const scale = Math.max(vw / source.width, vh / source.height)
    background.setScale(scale).setDepth(0)

    this.physics.world.setBounds(0, 0, vw, vh)

    const raccoonX = vw * 0.58
    const raccoonY = vh * 0.6
    const raccoonH = vh * 0.18
    this.raccoon = this.add.image(raccoonX, raccoonY, 'raccoon')
    this.raccoon.setDisplaySize(raccoonH, raccoonH).setDepth(5)

    this.talkIcon = this.add.image(raccoonX, raccoonY - raccoonH * 0.55, 'talk-icon')
    this.talkIcon.setDisplaySize(44, 44).setDepth(6)
    this.tweens.add({
      targets: this.talkIcon,
      y: this.talkIcon.y - 8,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    this.createDialogUi(vw, vh)
    this.ensureCharacterAnimations()

    const spawn = data.spawn ?? GYMNASTICS_ROOM_SPAWN
    this.player = this.physics.add.sprite(vw * spawn.xRatio, vh * spawn.yRatio, 'character', 0)
    this.player.setScale(0.55).setDepth(10)
    this.player.setCollideWorldBounds(true)
    this.player.body.setSize(FRAME_SIZE * 0.35, FRAME_SIZE * 0.25)
    this.player.body.setOffset(FRAME_SIZE * 0.33, FRAME_SIZE * 0.65)

    this.exitPortal = new Phaser.Geom.Rectangle(
      vw * GYMNASTICS_EXIT_PORTAL.xRatio,
      vh * GYMNASTICS_EXIT_PORTAL.yRatio,
      vw * GYMNASTICS_EXIT_PORTAL.widthRatio,
      vh * GYMNASTICS_EXIT_PORTAL.heightRatio,
    )

    this.cursors = this.input.keyboard!.createCursorKeys()

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isDialogVisible) {
        const bounds = this.dialogBox.getBounds()
        if (!Phaser.Geom.Rectangle.Contains(bounds, pointer.x, pointer.y)) {
          this.hideDialog()
        }
        return
      }

      const raccoonBounds = this.raccoon.getBounds()
      if (Phaser.Geom.Rectangle.Contains(raccoonBounds, pointer.x, pointer.y)) {
        this.showDialog()
        return
      }

      this.target = new Phaser.Math.Vector2(pointer.x, pointer.y)
      const marker = this.add.circle(pointer.x, pointer.y, 6, 0xffffff, 0.6)
      this.tweens.add({
        targets: marker,
        alpha: 0,
        scale: 2,
        duration: 400,
        onComplete: () => marker.destroy(),
      })
    })

    this.playerWasInExitPortal = true
    this.cameras.main.fadeIn(250, 0, 0, 0)
  }

  update() {
    const { left, right, up, down } = this.cursors
    const isKeyPressed = left.isDown || right.isDown || up.isDown || down.isDown

    if (this.isDialogVisible) {
      this.player.setVelocity(0, 0)
      this.player.anims.stop()
      return
    }

    let vx = 0
    let vy = 0

    if (isKeyPressed) {
      this.target = null
      if (left.isDown) {
        vx -= SPEED
        this.lastDirection = 'left'
      }
      if (right.isDown) {
        vx += SPEED
        this.lastDirection = 'right'
      }
      if (up.isDown) {
        vy -= SPEED
        this.lastDirection = 'up'
      }
      if (down.isDown) {
        vy += SPEED
        this.lastDirection = 'down'
      }
      if (vx !== 0 && vy !== 0) {
        vx *= 0.707
        vy *= 0.707
      }
    } else if (this.target) {
      const dx = this.target.x - this.player.x
      const dy = this.target.y - this.player.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 6) {
        this.target = null
      } else {
        const speed = Math.min(SPEED, dist * 5)
        vx = (dx / dist) * speed
        vy = (dy / dist) * speed
        if (Math.abs(dx) > Math.abs(dy)) {
          this.lastDirection = dx > 0 ? 'right' : 'left'
        } else {
          this.lastDirection = dy > 0 ? 'down' : 'up'
        }
      }
    }

    this.player.setVelocity(vx, vy)

    const moving = vx !== 0 || vy !== 0
    if (moving) {
      const anim = `walk-${this.lastDirection}`
      if (this.player.anims.currentAnim?.key !== anim || !this.player.anims.isPlaying) {
        this.player.anims.play(anim)
      }
    } else {
      this.player.anims.stop()
    }

    const inExit = Phaser.Geom.Rectangle.Contains(this.exitPortal, this.player.x, this.player.y)
    if (!this.isTransitioning && inExit && !this.playerWasInExitPortal) {
      this.returnToVillage()
    }
    this.playerWasInExitPortal = inExit
  }

  private createDialogUi(vw: number, vh: number) {
    const dialogW = Math.min(vw * 0.75, 860)
    this.dialogBox = this.add.image(vw / 2, vh - 80, 'seongsu-dialog')
    const dialogSrc = this.dialogBox.texture.getSourceImage() as HTMLImageElement
    this.dialogBox.setDisplaySize(dialogW, dialogW * (dialogSrc.height / dialogSrc.width))
    this.dialogBox.setDepth(20).setAlpha(0).setScrollFactor(0)
    this.dialogBox.y = vh - this.dialogBox.displayHeight / 2 + 30

    this.dialogScale = this.dialogBox.displayWidth / dialogSrc.width
    const dialogLeft = this.dialogBox.x - this.dialogBox.displayWidth / 2
    const dialogTop = this.dialogBox.y - this.dialogBox.displayHeight / 2
    this.dialogTextBaseX = dialogLeft + DIALOG_TEXT_BOX.x * this.dialogScale
    this.dialogTextBaseY = dialogTop + DIALOG_TEXT_BOX.y * this.dialogScale
    this.dialogTextBoxHeight = DIALOG_TEXT_BOX.height * this.dialogScale

    this.dialogText = this.add.text(this.dialogTextBaseX, this.dialogTextBaseY, '', {
      fontFamily: 'sans-serif',
      fontSize: `${Math.round(44 * this.dialogScale)}px`,
      color: '#3b2a1f',
      wordWrap: { width: DIALOG_TEXT_BOX.width * this.dialogScale, useAdvancedWrap: true },
      lineSpacing: Math.round(6 * this.dialogScale),
    })
    this.dialogText.setDepth(21).setAlpha(0).setScrollFactor(0).setOrigin(0, 0)
  }

  private showDialog() {
    const line = Phaser.Utils.Array.GetRandom(RACCOON_DIALOGS) as string
    this.dialogText.setText(line)
    this.layoutDialogText()
    this.isDialogVisible = true
    this.talkIcon.setTexture('talking-icon')

    this.tweens.killTweensOf(this.dialogBox)
    this.tweens.killTweensOf(this.dialogText)
    this.tweens.add({
      targets: [this.dialogBox, this.dialogText],
      alpha: 1,
      duration: 220,
      ease: 'Sine.easeOut',
    })
  }

  private hideDialog() {
    this.isDialogVisible = false
    this.talkIcon.setTexture('talk-icon')

    this.tweens.killTweensOf(this.dialogBox)
    this.tweens.killTweensOf(this.dialogText)
    this.tweens.add({
      targets: [this.dialogBox, this.dialogText],
      alpha: 0,
      duration: 180,
      ease: 'Sine.easeIn',
    })
  }

  private layoutDialogText() {
    const lineCount = this.dialogText.getWrappedText(this.dialogText.text).length
    const opticalOffset =
      lineCount <= 1
        ? 34 * this.dialogScale
        : lineCount === 2
          ? 28 * this.dialogScale
          : 8 * this.dialogScale
    const centeredY =
      this.dialogTextBaseY +
      Math.max(0, (this.dialogTextBoxHeight - this.dialogText.height) / 2) -
      opticalOffset
    this.dialogText.setPosition(this.dialogTextBaseX, centeredY)
  }

  private returnToVillage() {
    if (this.isTransitioning) return

    this.isTransitioning = true
    this.target = null
    this.player.setVelocity(0, 0)

    this.cameras.main.fadeOut(250, 0, 0, 0)
    this.time.delayedCall(250, () => {
      this.scene.start('VillageScene', {
        spawn: GYMNASTICS_RETURN_SPAWN,
      })
    })
  }

  private ensureCharacterAnimations() {
    if (this.anims.exists('walk-down')) return

    this.anims.create({
      key: 'walk-down',
      frames: this.anims.generateFrameNumbers('character', { start: 0, end: 3 }),
      frameRate: 8,
      repeat: -1,
    })
    this.anims.create({
      key: 'walk-left',
      frames: this.anims.generateFrameNumbers('character', { start: 4, end: 7 }),
      frameRate: 8,
      repeat: -1,
    })
    this.anims.create({
      key: 'walk-right',
      frames: this.anims.generateFrameNumbers('character', { start: 8, end: 11 }),
      frameRate: 8,
      repeat: -1,
    })
    this.anims.create({
      key: 'walk-up',
      frames: this.anims.generateFrameNumbers('character', { start: 12, end: 15 }),
      frameRate: 8,
      repeat: -1,
    })
  }
}
