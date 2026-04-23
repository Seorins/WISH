import Phaser from 'phaser'

const FRAME_SIZE = 313
const SPEED = 180
const TALK_DISTANCE = 55

const OBSTACLES = [
  { x: 0.16, y: 0.29, w: 0.25, h: 0.24 },
  { x: 0.46, y: 0.14, w: 0.13, h: 0.18 },
  { x: 0.85, y: 0.53, w: 0.11, h: 0.18 },
  { x: 0.63, y: 0.27, w: 0.13, h: 0.15 },
  { x: 0.84, y: 0.12, w: 0.14, h: 0.15 },
  { x: 0.5, y: 0.47, w: 0.06, h: 0.1 },
  { x: 0.04, y: 0.44, w: 0.06, h: 0.12 },
  { x: 0.27, y: 0.75, w: 0.05, h: 0.06 },
  { x: 0.5, y: 0.06, w: 1.0, h: 0.12 },
  { x: 0.03, y: 0.5, w: 0.06, h: 1.0 },
  { x: 0.96, y: 0.5, w: 0.08, h: 1.0 },
  { x: 0.5, y: 0.94, w: 1.0, h: 0.12 },
]

export class VillageScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private obstacles!: Phaser.Physics.Arcade.StaticGroup
  private sehyunNpc!: Phaser.GameObjects.Sprite
  private dialogBox!: Phaser.GameObjects.Image
  private target: Phaser.Math.Vector2 | null = null
  private lastDirection = 'down'
  private isDialogVisible = false
  private dialogDismissed = false

  constructor() {
    super({ key: 'VillageScene' })
  }

  preload() {
    this.load.image('main', '/assets/images/main.png')
    this.load.image('sehyun_talk', '/assets/images/sehyun_talk.png')
    this.load.image('profile', '/assets/images/profile.png')
    this.load.spritesheet('sehyun', '/assets/images/sehyun.png', {
      frameWidth: 313,
      frameHeight: 313,
      margin: 1,
      spacing: 0,
    })
    this.load.spritesheet('character', '/assets/images/character_sheet.png', {
      frameWidth: FRAME_SIZE,
      frameHeight: FRAME_SIZE,
      margin: 0,
      spacing: 0,
    })
  }

  create() {
    const { width, height } = this.scale

    // 배경
    const bg = this.add.image(width / 2, height / 2, 'main')
    const bgScale = Math.max(width / bg.width, height / bg.height)
    bg.setScale(bgScale).setDepth(0)

    const bgW = bg.width * bgScale
    const bgH = bg.height * bgScale
    const bgLeft = width / 2 - bgW / 2
    const bgTop = height / 2 - bgH / 2

    // 충돌 박스
    this.obstacles = this.physics.add.staticGroup()
    OBSTACLES.forEach(({ x, y, w, h }) => {
      const box = this.add
        .rectangle(bgLeft + x * bgW, bgTop + y * bgH, w * bgW, h * bgH, 0xff0000, 0)
        .setDepth(1)
      this.physics.add.existing(box, true)
      this.obstacles.add(box)
    })

    // 캐릭터 애니메이션
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

    // sehyun
    this.anims.create({
      key: 'sehyun-loop',
      frames: this.anims.generateFrameNumbers('sehyun', { start: 0, end: 15 }),
      frameRate: 6,
      repeat: -1,
    })
    this.sehyunNpc = this.add.sprite(width * 0.38, height * 0.55, 'sehyun').setDepth(4)
    this.sehyunNpc.setScale(0.38)
    this.sehyunNpc.anims.play('sehyun-loop')

    // sehyun 충돌 박스
    const sehyunBox = this.add
      .rectangle(this.sehyunNpc.x, this.sehyunNpc.y + 10, 40, 30, 0xff0000, 0)
      .setDepth(1)
    this.physics.add.existing(sehyunBox, true)
    this.obstacles.add(sehyunBox)

    // 대화창
    const dialogW = Math.min(width * 0.75, 860)
    this.dialogBox = this.add.image(width / 2, height - 80, 'sehyun_talk')
    this.dialogBox.setDisplaySize(dialogW, dialogW * (821 / 1916))
    this.dialogBox.setDepth(20).setAlpha(0)
    this.dialogBox.y = height - this.dialogBox.displayHeight / 2 + 30

    // 프로필
    const profileSize = Math.min(width * 0.16, 180)
    const profile = this.add.image(0, 0, 'profile')
    profile.setDisplaySize(profileSize, profileSize)
    profile.setDepth(20)
    profile.setScrollFactor(0)
    profile.x = profileSize / 2 + 12
    profile.y = profileSize / 2 + 12

    // 플레이어
    this.player = this.physics.add.sprite(width / 2, height * 0.65, 'character', 0)
    this.player.setScale(0.55).setDepth(5)
    this.player.setCollideWorldBounds(true)
    this.player.body.setSize(FRAME_SIZE * 0.35, FRAME_SIZE * 0.25)
    this.player.body.setOffset(FRAME_SIZE * 0.33, FRAME_SIZE * 0.65)

    this.physics.add.collider(this.player, this.obstacles)

    this.cursors = this.input.keyboard!.createCursorKeys()

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isDialogVisible) {
        const b = this.dialogBox.getBounds()
        const outside =
          pointer.x < b.left || pointer.x > b.right || pointer.y < b.top || pointer.y > b.bottom
        if (outside) {
          this.isDialogVisible = false
          this.dialogDismissed = true
          this.tweens.killTweensOf(this.dialogBox)
          this.tweens.add({ targets: this.dialogBox, alpha: 0, duration: 200, ease: 'Sine.easeIn' })
        }
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

    this.cameras.main.fadeIn(400, 0, 0, 0)
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

    if (this.isDialogVisible) {
      vx = 0
      vy = 0
      this.target = null
    }

    this.player.setVelocity(vx, vy)

    const moving = vx !== 0 || vy !== 0
    if (moving) {
      const anim = `walk-${this.lastDirection}`
      if (this.player.anims.currentAnim?.key !== anim) this.player.anims.play(anim)
    } else {
      this.player.anims.stop()
    }

    // sehyun 근접 감지 → 대화창
    const dx = this.player.x - this.sehyunNpc.x
    const dy = this.player.y - this.sehyunNpc.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const near = dist < TALK_DISTANCE

    if (near) {
      if (!this.isDialogVisible && !this.dialogDismissed) {
        this.isDialogVisible = true
        this.tweens.killTweensOf(this.dialogBox)
        this.tweens.add({ targets: this.dialogBox, alpha: 1, duration: 300, ease: 'Sine.easeOut' })
      }
    } else {
      this.dialogDismissed = false
      if (this.isDialogVisible) {
        this.isDialogVisible = false
        this.tweens.killTweensOf(this.dialogBox)
        this.tweens.add({ targets: this.dialogBox, alpha: 0, duration: 200, ease: 'Sine.easeIn' })
      }
    }
  }
}
