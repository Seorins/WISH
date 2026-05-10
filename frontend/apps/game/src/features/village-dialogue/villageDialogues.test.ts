import { describe, expect, it } from 'vitest'
import { villageDialogues } from './villageDialogues'
import type { VillagerNpcId } from './types'

const npcIds: VillagerNpcId[] = [
  'nurse_bunny',
  'sleepy_sheep',
  'gardener_bear',
  'monkey_friend',
  'squirrel_friend',
  'dain',
]

describe('villageDialogues', () => {
  it('defines three static scenes for each villager', () => {
    npcIds.forEach(npcId => {
      const script = villageDialogues[npcId]

      expect(script.npcId).toBe(npcId)
      expect(script.scenes).toHaveLength(3)
      script.scenes.forEach(scene => {
        expect(scene.questionText).toBeTruthy()
        expect(scene.choices.length).toBeGreaterThan(0)
        expect(scene.choices.length).toBeLessThanOrEqual(3)
      })
    })
  })

  it('starts each villager with the expected first question', () => {
    expect(villageDialogues.nurse_bunny.scenes[0].sceneId).toBe('nurse_bunny_01_body')
    expect(villageDialogues.sleepy_sheep.scenes[0].sceneId).toBe('sleepy_sheep_01_tired')
    expect(villageDialogues.gardener_bear.scenes[0].sceneId).toBe('gardener_bear_01_expression')
    expect(villageDialogues.monkey_friend.scenes[0].sceneId).toBe('monkey_friend_01_move')
    expect(villageDialogues.squirrel_friend.scenes[0].sceneId).toBe('squirrel_friend_01_worry')
    expect(villageDialogues.dain.scenes[0].sceneId).toBe('dain_01_friend')
  })

  it('keeps every choice static and stores raw check-in fields', () => {
    Object.values(villageDialogues).forEach(script => {
      script.scenes.forEach(scene => {
        scene.choices.forEach(choice => {
          expect(choice.choiceIntentId).toBeTruthy()
          expect(choice.text).toBeTruthy()
          expect(choice.npcResponse).toBeTruthy()
          expect([0, 1, 2, 3]).toContain(choice.intensity)
          expect(Array.isArray(choice.concernFlags)).toBe(true)
          expect(Array.isArray(choice.protectiveFactors)).toBe(true)
        })
      })
    })
  })

  it('does not include lighthouse-only rest_today wording', () => {
    const serialized = JSON.stringify(villageDialogues)

    expect(serialized).not.toContain('rest_today')
    expect(serialized).not.toContain('오늘은 쉬고 싶어요')
  })
})
