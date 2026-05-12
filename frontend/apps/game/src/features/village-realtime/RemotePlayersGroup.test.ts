import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { VillageMoveEvent, VillageSnapshot } from './types'

interface FakeSprite {
  x: number
  y: number
  destroy: ReturnType<typeof vi.fn>
  anims: {
    currentAnim: { key: string } | null
    isPlaying: boolean
    play: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
  }
}

interface FakeTween {
  stop: ReturnType<typeof vi.fn>
  config: Record<string, unknown>
}

const createPlayerMock = vi.fn()
const getPlayerWalkAnimationKeyMock = vi.fn()

vi.mock('@/game/entities/player', () => ({
  createPlayer: (...args: unknown[]) => createPlayerMock(...args),
  getPlayerWalkAnimationKey: (...args: unknown[]) => getPlayerWalkAnimationKeyMock(...args),
  PLAYER_TEXTURE_KEY: 'character',
}))

// Phaser 는 ESM 으로 import 되지만 RemotePlayersGroup 가 Phaser.Tweens.Tween 타입만 참조해서 런타임에는 사용하지 않으므로
// 빈 mock 으로 충분 — jsdom 환경에서 Phaser 가 canvas 를 만지지 않게 한다.
vi.mock('phaser', () => ({ default: {} }))

import { RemotePlayersGroup } from './RemotePlayersGroup'

function newFakeSprite(): FakeSprite {
  return {
    x: 0,
    y: 0,
    destroy: vi.fn(),
    anims: {
      currentAnim: null,
      isPlaying: false,
      play: vi.fn(),
      stop: vi.fn(),
    },
  }
}

function setupScene() {
  const sprites: FakeSprite[] = []
  const tweens: FakeTween[] = []

  createPlayerMock.mockImplementation((_scene: unknown, x: number, y: number) => {
    const sprite = newFakeSprite()
    sprite.x = x
    sprite.y = y
    sprites.push(sprite)
    return sprite
  })
  getPlayerWalkAnimationKeyMock.mockImplementation((dir: string) => `walk-${dir}`)

  const scene = {
    tweens: {
      add: vi.fn((config: Record<string, unknown>) => {
        const tween: FakeTween = { stop: vi.fn(), config }
        // tween 이 즉시 완료된 것처럼 sprite 좌표를 목표값으로 옮긴다 — 테스트 결정성 확보.
        const targets = config.targets as FakeSprite
        targets.x = config.x as number
        targets.y = config.y as number
        tweens.push(tween)
        return tween
      }),
    },
  }

  return { scene, sprites, tweens }
}

function group(scene: unknown, opts: Partial<{ localUserId: number; w: number; h: number }> = {}) {
  return new RemotePlayersGroup({
    scene: scene as never,
    localUserId: opts.localUserId ?? 99,
    worldWidth: opts.w ?? 1000,
    worldHeight: opts.h ?? 800,
  })
}

beforeEach(() => {
  createPlayerMock.mockReset()
  getPlayerWalkAnimationKeyMock.mockReset()
})

describe('RemotePlayersGroup', () => {
  it('applies snapshot and skips local user', () => {
    const { scene, sprites } = setupScene()
    const g = group(scene, { localUserId: 99 })

    const snapshot: VillageSnapshot = {
      members: [
        { userId: 1, nickname: 'a', textureKey: 'character', x: 0.5, y: 0.3, dir: 'down' },
        { userId: 99, nickname: 'me', textureKey: 'character', x: 0.4, y: 0.4, dir: 'down' },
        { userId: 2, nickname: 'b', textureKey: 'character', x: 0.7, y: 0.6, dir: 'left' },
      ],
    }
    g.applySnapshot(snapshot)

    expect(g.size()).toBe(2)
    expect(g.has(1)).toBe(true)
    expect(g.has(2)).toBe(true)
    expect(g.has(99)).toBe(false)
    expect(sprites).toHaveLength(2)
    // ratio → pixel 변환 검증
    expect(sprites[0]).toMatchObject({ x: 500, y: 240 })
    expect(sprites[1]).toMatchObject({ x: 700, y: 480 })
  })

  it('snapshot is idempotent — duplicate userId is not spawned twice', () => {
    const { scene } = setupScene()
    const g = group(scene)

    g.applySnapshot({
      members: [{ userId: 1, nickname: 'a', textureKey: 'character', x: 0.5, y: 0.5, dir: 'down' }],
    })
    g.applySnapshot({
      members: [{ userId: 1, nickname: 'a', textureKey: 'character', x: 0.5, y: 0.5, dir: 'down' }],
    })

    expect(g.size()).toBe(1)
    expect(createPlayerMock).toHaveBeenCalledTimes(1)
  })

  it('join event spawns a sprite and move event tweens it', () => {
    const { scene, sprites, tweens } = setupScene()
    const g = group(scene)

    g.applyEvent({
      type: 'join',
      userId: 1,
      nickname: 'a',
      textureKey: 'character',
      x: 0.1,
      y: 0.2,
      dir: 'down',
    })
    g.applyEvent({ type: 'move', userId: 1, x: 0.5, y: 0.6, dir: 'right', moving: true })

    expect(tweens).toHaveLength(1)
    expect(tweens[0].config).toMatchObject({ x: 500, y: 480, duration: 200 })
    expect(sprites[0].anims.play).toHaveBeenCalledWith('walk-right')
  })

  it('move skips tween when within threshold but updates anim', () => {
    const { scene, sprites, tweens } = setupScene()
    const g = group(scene)
    g.applyEvent({
      type: 'join',
      userId: 1,
      nickname: 'a',
      textureKey: 'character',
      x: 0.5,
      y: 0.5,
      dir: 'down',
    })

    // 동일 위치 패킷 — tween 안 만들고 anim 만 변경
    g.applyEvent({
      type: 'move',
      userId: 1,
      x: 0.5,
      y: 0.5,
      dir: 'up',
      moving: true,
    } as VillageMoveEvent)

    expect(tweens).toHaveLength(0)
    expect(sprites[0].anims.play).toHaveBeenCalledWith('walk-up')
  })

  it('move stops animation when moving=false', () => {
    const { scene, sprites } = setupScene()
    const g = group(scene)
    g.applyEvent({
      type: 'join',
      userId: 1,
      nickname: 'a',
      textureKey: 'character',
      x: 0.1,
      y: 0.1,
      dir: 'down',
    })

    g.applyEvent({ type: 'move', userId: 1, x: 0.4, y: 0.4, dir: 'down', moving: false })

    expect(sprites[0].anims.stop).toHaveBeenCalled()
  })

  it('successive moves stop the previous tween', () => {
    const { scene, tweens } = setupScene()
    const g = group(scene)
    g.applyEvent({
      type: 'join',
      userId: 1,
      nickname: 'a',
      textureKey: 'character',
      x: 0.1,
      y: 0.1,
      dir: 'down',
    })
    g.applyEvent({ type: 'move', userId: 1, x: 0.3, y: 0.3, dir: 'down', moving: true })
    g.applyEvent({ type: 'move', userId: 1, x: 0.6, y: 0.6, dir: 'down', moving: true })

    expect(tweens).toHaveLength(2)
    expect(tweens[0].stop).toHaveBeenCalled()
    expect(tweens[1].stop).not.toHaveBeenCalled()
  })

  it('leave removes the member and destroys sprite', () => {
    const { scene, sprites } = setupScene()
    const g = group(scene)
    g.applyEvent({
      type: 'join',
      userId: 1,
      nickname: 'a',
      textureKey: 'character',
      x: 0.1,
      y: 0.1,
      dir: 'down',
    })
    g.applyEvent({ type: 'leave', userId: 1 })

    expect(g.size()).toBe(0)
    expect(sprites[0].destroy).toHaveBeenCalled()
  })

  it('move arriving before join lazily spawns the sprite', () => {
    const { scene, sprites } = setupScene()
    const g = group(scene)

    g.applyEvent({ type: 'move', userId: 5, x: 0.5, y: 0.5, dir: 'left', moving: true })

    expect(g.size()).toBe(1)
    expect(sprites).toHaveLength(1)
  })

  it('move ignores the local user', () => {
    const { scene, sprites } = setupScene()
    const g = group(scene, { localUserId: 1 })

    g.applyEvent({ type: 'move', userId: 1, x: 0.5, y: 0.5, dir: 'down', moving: true })

    expect(g.size()).toBe(0)
    expect(sprites).toHaveLength(0)
  })

  it('destroy clears all members and stops tweens', () => {
    const { scene, sprites, tweens } = setupScene()
    const g = group(scene)
    g.applySnapshot({
      members: [
        { userId: 1, nickname: 'a', textureKey: 'character', x: 0.5, y: 0.5, dir: 'down' },
        { userId: 2, nickname: 'b', textureKey: 'character', x: 0.3, y: 0.3, dir: 'down' },
      ],
    })
    g.applyEvent({ type: 'move', userId: 1, x: 0.7, y: 0.7, dir: 'down', moving: true })

    g.destroy()

    expect(g.size()).toBe(0)
    expect(sprites[0].destroy).toHaveBeenCalled()
    expect(sprites[1].destroy).toHaveBeenCalled()
    expect(tweens[0].stop).toHaveBeenCalled()
  })
})
