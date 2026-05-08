import Phaser from 'phaser'

import { assetPath } from '@/game/assets/assetPath'
import type { TaekwondoBeltColor } from '@wish/api-client'

export const PLAYER_FRAME_SIZE = 313
export const PLAYER_WALK_SPEED = 180
export const PLAYER_TEXTURE_KEY = 'character'

export type PlayerDirection = 'down' | 'left' | 'right' | 'up'
export type RatioPoint = { xRatio: number; yRatio: number }
export type PlayerSprite = Phaser.Types.Physics.Arcade.SpriteWithDynamicBody

type CreatePlayerOptions = {
  textureKey?: string
  frame?: string | number
  scale?: number
  depth?: number
}

type UpdatePlayerMovementOptions = {
  player: PlayerSprite
  cursors: Phaser.Types.Input.Keyboard.CursorKeys
  target: Phaser.Math.Vector2 | null
  lastDirection: PlayerDirection
  speed?: number
  blocked?: boolean
}

type PlayerMovementResult = {
  target: Phaser.Math.Vector2 | null
  lastDirection: PlayerDirection
  moving: boolean
}

const CHARACTER_SHEET_PATH = assetPath('images/common/player/character_sheet.png')
const TAEKWONDO_BELT_PLAYER_SHEET_PATHS: Record<TaekwondoBeltColor, string> = {
  WHITE: assetPath('images/common/player/character_white.png'),
  YELLOW: assetPath('images/common/player/character_yellow.png'),
  ORANGE: assetPath('images/common/player/character_orange.png'),
  GREEN: assetPath('images/common/player/character_green.png'),
  BLUE: assetPath('images/common/player/character_blue.png'),
  PURPLE: assetPath('images/common/player/character_purple.png'),
  BROWN: assetPath('images/common/player/character_brown.png'),
  RED: assetPath('images/common/player/character_red.png'),
  BLACK: assetPath('images/common/player/character_black.png'),
}

export const TAEKWONDO_BELT_PLAYER_TEXTURE_KEYS: Record<TaekwondoBeltColor, string> = {
  WHITE: 'character-white',
  YELLOW: 'character-yellow',
  ORANGE: 'character-orange',
  GREEN: 'character-green',
  BLUE: 'character-blue',
  PURPLE: 'character-purple',
  BROWN: 'character-brown',
  RED: 'character-red',
  BLACK: 'character-black',
}

const PLAYER_WALK_ANIMATIONS: Array<{
  key: `walk-${PlayerDirection}`
  start: number
  end: number
}> = [
  { key: 'walk-down', start: 0, end: 3 },
  { key: 'walk-left', start: 4, end: 7 },
  { key: 'walk-right', start: 8, end: 11 },
  { key: 'walk-up', start: 12, end: 15 },
]

function getPlayerWalkAnimationKey(direction: PlayerDirection, textureKey = PLAYER_TEXTURE_KEY) {
  return textureKey === PLAYER_TEXTURE_KEY ? `walk-${direction}` : `walk-${direction}-${textureKey}`
}

export function getTaekwondoBeltPlayerTextureKey(beltColor: TaekwondoBeltColor) {
  return TAEKWONDO_BELT_PLAYER_TEXTURE_KEYS[beltColor]
}

export function loadPlayerSpritesheet(
  scene: Phaser.Scene,
  textureKey = PLAYER_TEXTURE_KEY,
  sheetPath = CHARACTER_SHEET_PATH,
) {
  scene.load.spritesheet(textureKey, sheetPath, {
    frameWidth: PLAYER_FRAME_SIZE,
    frameHeight: PLAYER_FRAME_SIZE,
    margin: 0,
    spacing: 0,
  })
}

export function loadTaekwondoBeltPlayerSpritesheets(scene: Phaser.Scene) {
  Object.entries(TAEKWONDO_BELT_PLAYER_SHEET_PATHS).forEach(([beltColor, sheetPath]) => {
    loadPlayerSpritesheet(
      scene,
      getTaekwondoBeltPlayerTextureKey(beltColor as TaekwondoBeltColor),
      sheetPath,
    )
  })
}

export function ensurePlayerWalkAnimations(scene: Phaser.Scene, textureKey = PLAYER_TEXTURE_KEY) {
  PLAYER_WALK_ANIMATIONS.forEach(({ key, start, end }) => {
    const direction = key.replace('walk-', '') as PlayerDirection
    const animationKey = getPlayerWalkAnimationKey(direction, textureKey)

    if (scene.anims.exists(animationKey)) {
      return
    }

    scene.anims.create({
      key: animationKey,
      frames: scene.anims.generateFrameNumbers(textureKey, { start, end }),
      frameRate: 8,
      repeat: -1,
    })
  })
}

export function createPlayer(
  scene: Phaser.Scene,
  x: number,
  y: number,
  {
    textureKey = PLAYER_TEXTURE_KEY,
    frame = 0,
    scale = 0.55,
    depth = 10,
  }: CreatePlayerOptions = {},
) {
  const player = scene.physics.add.sprite(x, y, textureKey, frame)
  player.setScale(scale).setDepth(depth)
  player.setCollideWorldBounds(true)
  player.body.setSize(PLAYER_FRAME_SIZE * 0.35, PLAYER_FRAME_SIZE * 0.25)
  player.body.setOffset(PLAYER_FRAME_SIZE * 0.33, PLAYER_FRAME_SIZE * 0.65)

  return player
}

export function updatePlayerMovement({
  player,
  cursors,
  target,
  lastDirection,
  speed = PLAYER_WALK_SPEED,
  blocked = false,
}: UpdatePlayerMovementOptions): PlayerMovementResult {
  let nextTarget = target
  let nextDirection = lastDirection
  let vx = 0
  let vy = 0

  if (blocked) {
    nextTarget = null
  } else {
    const { left, right, up, down } = cursors
    const isKeyPressed = left.isDown || right.isDown || up.isDown || down.isDown

    if (isKeyPressed) {
      nextTarget = null
      if (left.isDown) {
        vx -= speed
        nextDirection = 'left'
      }
      if (right.isDown) {
        vx += speed
        nextDirection = 'right'
      }
      if (up.isDown) {
        vy -= speed
        nextDirection = 'up'
      }
      if (down.isDown) {
        vy += speed
        nextDirection = 'down'
      }
      if (vx !== 0 && vy !== 0) {
        vx *= 0.707
        vy *= 0.707
      }
    } else if (nextTarget) {
      const dx = nextTarget.x - player.x
      const dy = nextTarget.y - player.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < 6) {
        nextTarget = null
      } else {
        const targetSpeed = Math.min(speed, dist * 5)
        vx = (dx / dist) * targetSpeed
        vy = (dy / dist) * targetSpeed
        nextDirection =
          Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
      }
    }
  }

  player.setVelocity(vx, vy)

  const moving = vx !== 0 || vy !== 0
  if (moving) {
    const anim = getPlayerWalkAnimationKey(nextDirection, player.texture.key)
    if (player.anims.currentAnim?.key !== anim || !player.anims.isPlaying) {
      player.anims.play(anim)
    }
  } else {
    player.anims.stop()
  }

  return { target: nextTarget, lastDirection: nextDirection, moving }
}

export function createClickTargetMarker(scene: Phaser.Scene, x: number, y: number) {
  const marker = scene.add.circle(x, y, 6, 0xffffff, 0.6)
  scene.tweens.add({
    targets: marker,
    alpha: 0,
    scale: 2,
    duration: 400,
    onComplete: () => marker.destroy(),
  })
}
