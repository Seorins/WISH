import Phaser from 'phaser'
import {
  createClickTargetMarker,
  createPlayer,
  ensurePlayerWalkAnimations,
  loadPlayerSpritesheet,
  type PlayerDirection,
  type PlayerSprite,
  updatePlayerMovement,
} from '@/game/entities/player'
import { fadeToScene } from '@/game/systems/sceneTransition'
import {
  createFloatingInteractionIcon,
  loadInteractionIcons,
  setInteractionIconActive,
} from '@/game/ui/interactionIcon'
import { addCoverBackground } from '@/game/world/background'
import { createRatioRectangle, isPointInRectangle } from '@/game/world/portal'

const TALK_DISTANCE = 100
const TAEKWONDO_SPRITE_FRAME = { width: 384, height: 512 }
const ROOM_SPAWN = { xRatio: 0.5, yRatio: 0.78 }
const EXIT_PORTAL = { xRatio: 0.45, yRatio: 0.8, widthRatio: 0.11, heightRatio: 0.26 }
const RETURN_SPAWN = { xRatio: 0.49, yRatio: 0.2 }
const SEOKJAE = { xRatio: 0.52, yRatio: 0.58, scaleRatio: 0.34 }
const SEOKJAE_TALK_ICON_OFFSET = { yRatio: 0.15 }
const SEOKJAE_POSES = [0, 1, 2]
const RANDOM_POSE_DELAY = 500

export class TaekwondoSelectScene extends Phaser.Scene {
  private player!: PlayerSprite
  private seokjaeNpc!: Phaser.GameObjects.Sprite
  private talkIcon!: Phaser.GameObjects.Image
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private target: Phaser.Math.Vector2 | null = null
  private lastDirection: PlayerDirection = 'down'
  private exitPortal!: Phaser.Geom.Rectangle
  private randomPoseTimer?: Phaser.Time.TimerEvent
  private isTransitioning = false

  private readonly handlePointerDown = (pointer: Phaser.Input.Pointer) => {
    this.target = new Phaser.Math.Vector2(pointer.x, pointer.y)
    createClickTargetMarker(this, pointer.x, pointer.y)
  }

  constructor() {
    super({ key: 'TaekwondoSelectScene' })
  }

  preload() {
    this.load.image(
      'taekwondo-room-background',
      '/assets/images/themes/taekwondo/background/taekwondo_inside.png',
    )
    loadInteractionIcons(this)
    this.load.spritesheet(
      'seokjae',
      '/assets/images/themes/taekwondo/characters/seokjae_sprite.png',
      {
        frameWidth: TAEKWONDO_SPRITE_FRAME.width,
        frameHeight: TAEKWONDO_SPRITE_FRAME.height,
        margin: 0,
        spacing: 0,
      },
    )
    loadPlayerSpritesheet(this)
  }

  create() {
    const { width: vw, height: vh } = this.scale
    this.isTransitioning = false
    this.target = null

    addCoverBackground(this, 'taekwondo-room-background')

    this.physics.world.setBounds(0, 0, vw, vh)
    ensurePlayerWalkAnimations(this)
    this.createSeokjaeNpc(vw, vh)

    this.player = createPlayer(this, vw * ROOM_SPAWN.xRatio, vh * ROOM_SPAWN.yRatio)

    this.exitPortal = createRatioRectangle(vw, vh, EXIT_PORTAL)

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.input.on('pointerdown', this.handlePointerDown)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown', this.handlePointerDown)
      this.randomPoseTimer?.remove(false)
      this.randomPoseTimer = undefined
    })

    this.cameras.main.fadeIn(250, 0, 0, 0)
  }

  update() {
    const movement = updatePlayerMovement({
      player: this.player,
      cursors: this.cursors,
      target: this.target,
      lastDirection: this.lastDirection,
    })
    this.target = movement.target
    this.lastDirection = movement.lastDirection

    this.updateSeokjaeTalkIcon()

    if (
      !this.isTransitioning &&
      isPointInRectangle(this.exitPortal, this.player.x, this.player.y)
    ) {
      this.returnToVillage()
    }
  }

  private createSeokjaeNpc(vw: number, vh: number) {
    this.seokjaeNpc = this.add
      .sprite(vw * SEOKJAE.xRatio, vh * SEOKJAE.yRatio, 'seokjae', 0)
      .setDepth(6)
    const scale = (Math.min(vw, vh) / TAEKWONDO_SPRITE_FRAME.height) * SEOKJAE.scaleRatio
    this.seokjaeNpc.setScale(scale)
    this.createSeokjaeTalkIcon(vh)
    this.startRandomSeokjaePose()
  }

  private createSeokjaeTalkIcon(vh: number) {
    this.talkIcon = createFloatingInteractionIcon(this, {
      x: this.seokjaeNpc.x,
      y: this.seokjaeNpc.y - vh * SEOKJAE_TALK_ICON_OFFSET.yRatio,
    })
  }

  private updateSeokjaeTalkIcon() {
    const distanceToSeokjae = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.seokjaeNpc.x,
      this.seokjaeNpc.y,
    )
    setInteractionIconActive(this.talkIcon, distanceToSeokjae <= TALK_DISTANCE)
  }

  private startRandomSeokjaePose() {
    this.seokjaeNpc.setFrame(Phaser.Utils.Array.GetRandom(SEOKJAE_POSES))
    this.randomPoseTimer = this.time.addEvent({
      delay: RANDOM_POSE_DELAY,
      loop: true,
      callback: () => {
        this.seokjaeNpc.setFrame(Phaser.Utils.Array.GetRandom(SEOKJAE_POSES))
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

    fadeToScene(this, 'VillageScene', {
      duration: 250,
      data: {
        spawn: RETURN_SPAWN,
        portalCooldownMs: 250,
      },
    })
  }
}
