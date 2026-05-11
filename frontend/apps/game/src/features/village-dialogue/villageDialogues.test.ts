import { describe, expect, it } from 'vitest'
import { NPC_IDENTITY_MAP } from '../npcIdentity'
import { SHARED_COUNSELING_SCRIPTS } from './sharedCounselingScripts'
import type { VillagerNpcId } from './types'
import { VILLAGER_FIRST_GREETING, villageDialogues } from './villageDialogues'

const npcIds: VillagerNpcId[] = [
  'nurse_bunny',
  'sleepy_sheep',
  'gardener_bear',
  'monkey_friend',
  'squirrel_friend',
  'dain',
]

describe('villageDialogues', () => {
  it('keeps display names and backend enum names separated for every villager', () => {
    npcIds.forEach(npcId => {
      const identity = villageDialogues[npcId]

      expect(identity.npcId).toBe(npcId)
      expect(identity.displayName).toBe(NPC_IDENTITY_MAP[npcId].displayName)
      expect(identity.backendNpcName).toBe(NPC_IDENTITY_MAP[npcId].backendNpcName)
      expect(VILLAGER_FIRST_GREETING[npcId].length).toBeGreaterThan(0)
      expect(Array.isArray(VILLAGER_FIRST_GREETING[npcId])).toBe(false)
      expect('scenes' in identity).toBe(false)
      expect('topics' in identity).toBe(false)
    })
  })

  it('defines a shared counseling script pool with optional one-line context and short routes', () => {
    expect(SHARED_COUNSELING_SCRIPTS.length).toBeGreaterThanOrEqual(6)

    SHARED_COUNSELING_SCRIPTS.forEach(script => {
      expect(script.scriptId).toBeTruthy()
      expect('startLines' in script).toBe(false)
      expect('closingLine' in script).toBe(false)
      expect(script.contextLine?.split('\n').length ?? 1).toBe(1)
      expect(script.nodes[script.startNodeId]).toBeTruthy()
      expect(Object.keys(script.nodes).length).toBeLessThanOrEqual(4)

      Object.values(script.nodes).forEach(node => {
        expect(node.nodeId).toBeTruthy()
        expect(node.questionText).toBeTruthy()
        expect(node.choices.length).toBeGreaterThan(0)
        expect(node.choices.length).toBeLessThanOrEqual(3)
      })
    })
  })

  it('keeps every terminal choice waiting on choice-specific ending lines', () => {
    SHARED_COUNSELING_SCRIPTS.forEach(script => {
      Object.values(script.nodes).forEach(node => {
        node.choices.forEach(choice => {
          expect(choice.choiceIntentId).toBeTruthy()
          expect(choice.text).toBeTruthy()
          expect(choice.responseLines.length).toBeGreaterThan(0)
          expect([0, 1, 2, 3]).toContain(choice.intensity)
          expect(Array.isArray(choice.concernFlags)).toBe(true)
          expect(Array.isArray(choice.protectiveFactors)).toBe(true)

          if (!choice.nextNodeId || choice.endAfterSelect) {
            expect(choice.endingLines?.length).toBeGreaterThan(0)
            expect(choice.endingLines?.length).toBeLessThanOrEqual(2)
          }
        })
      })
    })
  })

  it('maps monkey_friend to backend SEORIN while displaying Korean name', () => {
    expect(villageDialogues.monkey_friend).toMatchObject({
      displayName: '코몽',
      backendNpcName: 'SEORIN',
    })
  })

  it('does not include lighthouse-only or internal wording in shared scripts', () => {
    const serialized = JSON.stringify(SHARED_COUNSELING_SCRIPTS)

    expect(serialized).not.toContain('rest_today')
    expect(serialized).not.toContain('LLM')
    expect(serialized).not.toContain('Claude')
    expect(serialized).not.toContain('API')
  })
})
