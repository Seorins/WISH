import Phaser from 'phaser'

const FRAME_SIZE = 313
const SPEED = 180
const ART_ROOM_SPAWN = { xRatio: 0.5, yRatio: 0.76 }
const ART_EXIT_PORTAL = { xRatio: 0.44, yRatio: 0.86, widthRatio: 0.12, heightRatio: 0.12 }
const ART_RETURN_SPAWN = { xRatio: 0.585, yRatio: 0.855 }
const RUMI_TALK_ICON = { xRatio: 0.335, yRatio: 0.33 }

export class ArtSelectScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private target: Phaser.Math.Vector2 | null = null
  private lastDirection = 'down'
  private exitPortal!: Phaser.Geom.Rectangle
  private isTransitioning = false

  constructor() {
    super({ key: 'ArtSelectScene' })
  }

  preload() {
    this.load.image('art-room-background', '/assets/images/themes/art/background/background.png')
    this.load.image('talk-icon', '/assets/images/ui/icons/talk.png')
    this.load.spritesheet('character', '/assets/images/common/player/character_sheet.png', {
      frameWidth: FRAME_SIZE,
      frameHeight: FRAME_SIZE,
      margin: 0,
      spacing: 0,
    })
  }

  create() {
    const { width: vw, height: vh } = this.scale
    this.isTransitioning = false
    this.target = null

    const background = this.add.image(vw / 2, vh / 2, 'art-room-background')
    const source = background.texture.getSourceImage() as HTMLImageElement
    const scale = Math.max(vw / source.width, vh / source.height)
    background.setScale(scale).setDepth(0)

    const backgroundLeft = background.x - background.displayWidth / 2
    const backgroundTop = background.y - background.displayHeight / 2
    const talkIcon = this.add
      .image(
        backgroundLeft + background.displayWidth * RUMI_TALK_ICON.xRatio,
        backgroundTop + background.displayHeight * RUMI_TALK_ICON.yRatio,
        'talk-icon',
      )
      .setDepth(12)
      .setDisplaySize(56, 56)
    this.tweens.add({
      targets: talkIcon,
      y: talkIcon.y - 10,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    this.physics.world.setBounds(0, 0, vw, vh)

    this.ensureCharacterAnimations()

    this.player = this.physics.add.sprite(
      vw * ART_ROOM_SPAWN.xRatio,
      vh * ART_ROOM_SPAWN.yRatio,
      'character',
      0,
    )
    this.player.setScale(0.55).setDepth(10)
    this.player.setCollideWorldBounds(true)
    this.player.body.setSize(FRAME_SIZE * 0.35, FRAME_SIZE * 0.25)
    this.player.body.setOffset(FRAME_SIZE * 0.33, FRAME_SIZE * 0.65)

    this.exitPortal = new Phaser.Geom.Rectangle(
      vw * ART_EXIT_PORTAL.xRatio,
      vh * ART_EXIT_PORTAL.yRatio,
      vw * ART_EXIT_PORTAL.widthRatio,
      vh * ART_EXIT_PORTAL.heightRatio,
    )

    this.cursors = this.input.keyboard!.createCursorKeys()

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
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

    this.cameras.main.fadeIn(250, 0, 0, 0)
  }

  update() {
    const { left, right, up, down } = this.cursors
    const isKeyPressed = left.isDown || right.isDown || up.isDown || down.isDown

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

    if (Phaser.Geom.Rectangle.Contains(this.exitPortal, this.player.x, this.player.y)) {
      this.returnToVillage()
    }
  }

  private returnToVillage() {
    if (this.isTransitioning) {
      return
    }

    this.isTransitioning = true
    this.target = null
    this.player.setVelocity(0, 0)

    this.cameras.main.fadeOut(250, 0, 0, 0)
    this.time.delayedCall(250, () => {
      this.scene.start('VillageScene', {
        spawn: ART_RETURN_SPAWN,
        portalCooldownMs: 250,
      })
    })
  }

  private ensureCharacterAnimations() {
    if (!this.anims.exists('walk-down')) {
      this.anims.create({
        key: 'walk-down',
        frames: this.anims.generateFrameNumbers('character', { start: 0, end: 3 }),
        frameRate: 8,
        repeat: -1,
      })
    }
    if (!this.anims.exists('walk-left')) {
      this.anims.create({
        key: 'walk-left',
        frames: this.anims.generateFrameNumbers('character', { start: 4, end: 7 }),
        frameRate: 8,
        repeat: -1,
      })
    }
    if (!this.anims.exists('walk-right')) {
      this.anims.create({
        key: 'walk-right',
        frames: this.anims.generateFrameNumbers('character', { start: 8, end: 11 }),
        frameRate: 8,
        repeat: -1,
      })
    }
    if (!this.anims.exists('walk-up')) {
      this.anims.create({
        key: 'walk-up',
        frames: this.anims.generateFrameNumbers('character', { start: 12, end: 15 }),
        frameRate: 8,
        repeat: -1,
      })
    }
  }
}
