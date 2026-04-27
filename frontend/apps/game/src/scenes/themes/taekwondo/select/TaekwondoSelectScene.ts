import Phaser from 'phaser'

const FRAME_SIZE = 313
const SPEED = 180
const TAEKWONDO_SPRITE_FRAME = { width: 384, height: 512 }
const ROOM_SPAWN = { xRatio: 0.5, yRatio: 0.78 }
const EXIT_PORTAL = { xRatio: 0.45, yRatio: 0.8, widthRatio: 0.11, heightRatio: 0.26 }
const RETURN_SPAWN = { xRatio: 0.49, yRatio: 0.2 }
const PRACTICE_CHARACTER = { xRatio: 0.52, yRatio: 0.58, scaleRatio: 0.34 }
const PRACTICE_POSES = [0, 1, 2]
const RANDOM_POSE_DELAY = 500

export class TaekwondoSelectScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
  private practiceCharacter!: Phaser.GameObjects.Sprite
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private target: Phaser.Math.Vector2 | null = null
  private lastDirection = 'down'
  private exitPortal!: Phaser.Geom.Rectangle
  private isTransitioning = false

  private readonly handlePointerDown = (pointer: Phaser.Input.Pointer) => {
    this.target = new Phaser.Math.Vector2(pointer.x, pointer.y)
    const marker = this.add.circle(pointer.x, pointer.y, 6, 0xffffff, 0.6)
    this.tweens.add({
      targets: marker,
      alpha: 0,
      scale: 2,
      duration: 400,
      onComplete: () => marker.destroy(),
    })
  }

  constructor() {
    super({ key: 'TaekwondoSelectScene' })
  }

  preload() {
    this.load.image(
      'taekwondo-room-background',
      '/assets/images/themes/taekwondo/background/taekwondo_inside.png',
    )
    this.load.spritesheet(
      'taekwondo-practice-character',
      '/assets/images/themes/taekwondo/characters/taekwondo_sprite.png',
      {
        frameWidth: TAEKWONDO_SPRITE_FRAME.width,
        frameHeight: TAEKWONDO_SPRITE_FRAME.height,
        margin: 0,
        spacing: 0,
      },
    )
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

    const background = this.add.image(vw / 2, vh / 2, 'taekwondo-room-background')
    const source = background.texture.getSourceImage() as HTMLImageElement
    const scale = Math.max(vw / source.width, vh / source.height)
    background.setScale(scale).setDepth(0)

    this.physics.world.setBounds(0, 0, vw, vh)
    this.ensureCharacterAnimations()
    this.createPracticeCharacter(vw, vh)

    this.player = this.physics.add.sprite(
      vw * ROOM_SPAWN.xRatio,
      vh * ROOM_SPAWN.yRatio,
      'character',
      0,
    )
    this.player.setScale(0.55).setDepth(10)
    this.player.setCollideWorldBounds(true)
    this.player.body.setSize(FRAME_SIZE * 0.35, FRAME_SIZE * 0.25)
    this.player.body.setOffset(FRAME_SIZE * 0.33, FRAME_SIZE * 0.65)

    this.exitPortal = new Phaser.Geom.Rectangle(
      vw * EXIT_PORTAL.xRatio,
      vh * EXIT_PORTAL.yRatio,
      vw * EXIT_PORTAL.widthRatio,
      vh * EXIT_PORTAL.heightRatio,
    )

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.input.on('pointerdown', this.handlePointerDown)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown', this.handlePointerDown)
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

  private createPracticeCharacter(vw: number, vh: number) {
    this.practiceCharacter = this.add
      .sprite(
        vw * PRACTICE_CHARACTER.xRatio,
        vh * PRACTICE_CHARACTER.yRatio,
        'taekwondo-practice-character',
        0,
      )
      .setDepth(6)
    const scale = (Math.min(vw, vh) / TAEKWONDO_SPRITE_FRAME.height) * PRACTICE_CHARACTER.scaleRatio
    this.practiceCharacter.setScale(scale)
    this.startRandomPracticePose()
  }

  private startRandomPracticePose() {
    this.practiceCharacter.setFrame(Phaser.Utils.Array.GetRandom(PRACTICE_POSES))
    this.time.addEvent({
      delay: RANDOM_POSE_DELAY,
      loop: true,
      callback: () => {
        this.practiceCharacter.setFrame(Phaser.Utils.Array.GetRandom(PRACTICE_POSES))
      },
    })
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
        spawn: RETURN_SPAWN,
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
