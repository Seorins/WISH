import { describe, expect, it } from 'vitest'
import { NPC_IDENTITY_MAP } from '../npcIdentity'
import { buildActivityAwareEndingLines } from './activityAwareEnding'
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
      expect(VILLAGER_FIRST_GREETING[npcId]).toHaveLength(2)
      expect(Array.isArray(VILLAGER_FIRST_GREETING[npcId])).toBe(true)
      VILLAGER_FIRST_GREETING[npcId].forEach(greeting => {
        expect(greeting.split('\n')).toHaveLength(1)
      })
      expect('scenes' in identity).toBe(false)
      expect('topics' in identity).toBe(false)
    })
  })

  it('keeps first greetings short and free of topic wording', () => {
    const serializedGreetings = JSON.stringify(VILLAGER_FIRST_GREETING)

    expect(VILLAGER_FIRST_GREETING.nurse_bunny).toEqual(['안녕, 왔네.', '잠깐 쉬어가도 돼.'])
    expect(serializedGreetings).not.toContain('들렀구나')
    expect(serializedGreetings).not.toContain('또는')
    expect(serializedGreetings).not.toContain('오늘 몸')
    expect(serializedGreetings).not.toContain('가족 생각')
    expect(serializedGreetings).not.toContain('기분이 복잡')
    expect(serializedGreetings).not.toContain('말로 하기 어려운')
    expect(serializedGreetings).not.toContain('검사')
    expect(serializedGreetings).not.toContain('주사')
  })

  it('starts every shared static script from the neutral entry node', () => {
    expect(SHARED_COUNSELING_SCRIPTS.length).toBeGreaterThanOrEqual(6)

    SHARED_COUNSELING_SCRIPTS.forEach(script => {
      const entryNode = script.nodes[script.startNodeId]

      expect(script.scriptId).toBeTruthy()
      expect('startLines' in script).toBe(false)
      expect('closingLine' in script).toBe(false)
      expect(script.startNodeId).toBe('entry_01')
      expect(entryNode).toBeTruthy()
      expect(entryNode.questionText).toBe('오늘은 뭐가 좋을까?')
      expect(entryNode.choices.map(choice => choice.text)).toEqual([
        '쉬고 싶어요',
        '뭔가 해보고 싶어요',
        '얘기하고 싶어요',
      ])
      expect(Object.keys(script.nodes).length).toBeGreaterThanOrEqual(10)

      Object.values(script.nodes).forEach(node => {
        expect(node.nodeId).toBeTruthy()
        expect(node.questionText).toBeTruthy()
        expect(node.choices.length).toBeGreaterThan(0)
        expect(node.choices.length).toBeLessThanOrEqual(3)
      })
    })
  })

  it('keeps sensitive hospital topics behind the child-selected worry route', () => {
    SHARED_COUNSELING_SCRIPTS.forEach(script => {
      const entryNode = script.nodes[script.startNodeId]
      const entrySerialized = JSON.stringify(entryNode)

      expect(entrySerialized).not.toContain('주사')
      expect(entrySerialized).not.toContain('검사')
      expect(entrySerialized).not.toContain('아픈')
      expect(entrySerialized).not.toContain('가족이 걱정')

      const talkChoice = entryNode.choices.find(choice => choice.choiceIntentId === 'entry_talk')
      expect(talkChoice?.nextNodeId).toBe('talk_topic_01')

      const worryChoice = script.nodes.talk_topic_01.choices.find(
        choice => choice.choiceIntentId === 'talk_worry',
      )
      expect(worryChoice?.nextNodeId).toBe('worry_01')

      const hospitalChoice = script.nodes.worry_01.choices.find(
        choice => choice.choiceIntentId === 'worry_hospital',
      )
      expect(hospitalChoice?.nextNodeId).toBe('hospital_02')
      expect(script.nodes.hospital_02.choices.map(choice => choice.text)).toContain(
        '주사가 걱정돼요',
      )
    })
  })

  it('keeps every terminal choice waiting on explicit or activity-aware ending lines', () => {
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
            const hasExplicitEnding = Boolean(choice.endingLines?.length)
            const hasActivityEnding = Boolean(choice.activityEndingLines)
            const hasActivityAwareEndingType = Boolean(choice.endingType)

            expect(hasExplicitEnding || hasActivityEnding || hasActivityAwareEndingType).toBe(true)
            expect(choice.endingLines?.length ?? 0).toBeLessThanOrEqual(2)
            expect(choice.activityEndingLines?.pending.length ?? 0).toBeLessThanOrEqual(2)
            expect(choice.activityEndingLines?.completed.length ?? 0).toBeLessThanOrEqual(2)

            if (choice.endingType) {
              expect(
                buildActivityAwareEndingLines({
                  endingType: choice.endingType,
                  dailyActivityState: {
                    completedActivityCount: 0,
                    hasDoneAnyActivityToday: false,
                    recommendedActivityLabel: '가벼운 활동',
                  },
                }).length,
              ).toBeGreaterThan(0)
            }
          }
        })
      })
    })
  })

  it('does not use burdening wording in shared static villager scripts', () => {
    const serialized = JSON.stringify(SHARED_COUNSELING_SCRIPTS)

    expect(serialized).not.toContain('열심히')
    expect(serialized).not.toContain('꼭')
    expect(serialized).not.toContain('해야 해')
    expect(serialized).not.toContain('choiceIntentId:')
    expect(serialized).not.toContain('intensity:')
    expect(serialized).not.toContain('concernFlags:')
    expect(serialized).not.toContain('protectiveFactors:')
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
