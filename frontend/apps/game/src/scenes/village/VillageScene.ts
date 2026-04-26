import Phaser from 'phaser'

const FRAME_SIZE = 313
const SPEED = 180
const TALK_DISTANCE = 55

type ObstacleRect = { x: number; y: number; w: number; h: number }

const OBSTACLES: ObstacleRect[] = []

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
    this.load.image('map', '/assets/images/village/background/map.png')
    this.load.image('sehyun_talk', '/assets/images/npcs/sehyun/talk-panel.png')
    this.load.image('profile', '/assets/images/common/profile.png')
    this.load.image('menu', '/assets/images/ui/buttons/menu.png')
    this.load.spritesheet('sehyun', '/assets/images/npcs/sehyun/sprite.png', {
      frameWidth: 313,
      frameHeight: 313,
      margin: 1,
      spacing: 0,
    })
    this.load.spritesheet('character', '/assets/images/common/player/character_sheet.png', {
      frameWidth: FRAME_SIZE,
      frameHeight: FRAME_SIZE,
      margin: 0,
      spacing: 0,
    })
  }

  create() {
    const { width: vw, height: vh } = this.scale

    const mapImg = this.textures.get('map').getSourceImage() as HTMLImageElement
    const rawW = mapImg.width
    const rawH = mapImg.height
    const mapScale = Math.max(vw / rawW, vh / rawH) * 3

    const W = rawW * mapScale
    const H = rawH * mapScale

    this.add
      .image(W / 2, H / 2, 'map')
      .setScale(mapScale)
      .setDepth(0)

    // ── 월드 & 카메라 바운드
    this.physics.world.setBounds(0, 0, W, H)
    this.cameras.main.setBounds(0, 0, W, H)

    // ── 장애물
    this.obstacles = this.physics.add.staticGroup()
    OBSTACLES.forEach(({ x, y, w, h }) => {
      const box = this.add.rectangle(x * W, y * H, w * W, h * H, 0xff0000, 0).setDepth(1)
      this.physics.add.existing(box, true)
      this.obstacles.add(box)
    })

    // ── 캐릭터 애니메이션
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

    // ── sehyun NPC
    this.anims.create({
      key: 'sehyun-loop',
      frames: this.anims.generateFrameNumbers('sehyun', { start: 0, end: 15 }),
      frameRate: 6,
      repeat: -1,
    })
    this.sehyunNpc = this.add.sprite(0.38 * W, 0.55 * H, 'sehyun').setDepth(4)
    this.sehyunNpc.setScale(0.38)
    this.sehyunNpc.anims.play('sehyun-loop')

    const sehyunBox = this.add
      .rectangle(this.sehyunNpc.x, this.sehyunNpc.y + 10, 40, 30, 0xff0000, 0)
      .setDepth(1)
    this.physics.add.existing(sehyunBox, true)
    this.obstacles.add(sehyunBox)

    // ── 대화창 (카메라 고정)
    const dialogW = Math.min(vw * 0.75, 860)
    this.dialogBox = this.add.image(vw / 2, vh - 80, 'sehyun_talk')
    this.dialogBox.setDisplaySize(dialogW, dialogW * (821 / 1916))
    this.dialogBox.setDepth(20).setAlpha(0).setScrollFactor(0)
    this.dialogBox.y = vh - this.dialogBox.displayHeight / 2 + 30

    // ── 프로필 (카메라 고정)
    const profileSize = Math.min(vw * 0.16, 180)
    const profile = this.add.image(0, 0, 'profile')
    profile.setDisplaySize(profileSize, profileSize)
    profile.setDepth(20)
    profile.setScrollFactor(0)
    profile.x = profileSize / 2 + 12
    profile.y = profileSize / 2 + 12

    // ── 메뉴 (프로필 아래, 카메라 고정)
    const menu = this.add.image(0, 0, 'menu')
    const menuW = profileSize * 0.65
    menu.setDisplaySize(menuW, menuW * (menu.height / menu.width))
    menu.setDepth(20).setScrollFactor(0)
    menu.x = menuW / 2 + 12 + (profileSize - menuW) / 2
    menu.y = profile.y + profileSize / 2 + menu.displayHeight / 2 - 4

    // ── 플레이어
    this.player = this.physics.add.sprite(W / 2, H * 0.47, 'character', 0)
    this.player.setScale(0.55).setDepth(5)
    this.player.setCollideWorldBounds(true)
    this.player.body.setSize(FRAME_SIZE * 0.35, FRAME_SIZE * 0.25)
    this.player.body.setOffset(FRAME_SIZE * 0.33, FRAME_SIZE * 0.65)

    this.physics.add.collider(this.player, this.obstacles)

    // ── 카메라: 초기 중앙 정렬 후 플레이어 따라가기
    this.cameras.main.centerOn(this.player.x, this.player.y)
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12)

    this.cursors = this.input.keyboard!.createCursorKeys()

    // ── ESC 키로 대화창 닫기
    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.isDialogVisible) {
        this.isDialogVisible = false
        this.dialogDismissed = true
        this.tweens.killTweensOf(this.dialogBox)
        this.tweens.add({ targets: this.dialogBox, alpha: 0, duration: 200, ease: 'Sine.easeIn' })
      }
    })

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
      this.target = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY)
      const marker = this.add.circle(pointer.worldX, pointer.worldY, 6, 0xffffff, 0.6)
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
      if (this.player.anims.currentAnim?.key !== anim || !this.player.anims.isPlaying)
        this.player.anims.play(anim)
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
