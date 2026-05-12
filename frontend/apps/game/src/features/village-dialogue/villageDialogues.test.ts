import { describe, expect, it, vi } from 'vitest'
import { buildActivityAwareEndingLines } from './activityAwareEnding'
import { SHARED_COUNSELING_SCRIPTS, VILLAGER_COUNSELING_SCRIPT } from './sharedCounselingScripts'
import type { VillagerNpcId } from './types'
import { getVillagerLines } from './villagerLinePack'
import {
  VILLAGER_FIRST_GREETING,
  VILLAGER_IDENTITIES,
  VILLAGER_PERSONAS,
  villageDialogues,
} from './villageDialogues'

const npcIds: VillagerNpcId[] = [
  'nurse_bunny',
  'sleepy_sheep',
  'gardener_bear',
  'monkey_friend',
  'squirrel_friend',
  'dain',
]

describe('villageDialogues', () => {
  it('uses the expected display names and backend enum names for every villager', () => {
    expect(VILLAGER_IDENTITIES).toMatchObject({
      nurse_bunny: { displayName: '간호사 조은', backendNpcName: 'JOEUN' },
      sleepy_sheep: { displayName: '건빈', backendNpcName: 'GEONBIN' },
      gardener_bear: { displayName: '정호', backendNpcName: 'JEONGHO' },
      monkey_friend: { displayName: '코몽', backendNpcName: 'SEORIN' },
      squirrel_friend: { displayName: '세현', backendNpcName: 'SEHYEON' },
      dain: { displayName: '다인', backendNpcName: 'DAIN' },
    })

    npcIds.forEach(npcId => {
      expect(villageDialogues[npcId]).toMatchObject(VILLAGER_IDENTITIES[npcId])
      expect(VILLAGER_PERSONAS[npcId].speakingRules.length).toBeGreaterThan(0)
    })
  })

  it('shows two-line character greetings without dry or sensitive wording', () => {
    const serializedGreetings = JSON.stringify(VILLAGER_FIRST_GREETING)

    expect(VILLAGER_FIRST_GREETING.nurse_bunny).toEqual([
      '안녕, 오늘 하루 어땠어?',
      '편한 자리에 앉아봐.',
    ])
    expect(VILLAGER_FIRST_GREETING.monkey_friend).toEqual([
      '우와, 기다리고 있었어!',
      '코몽이랑 뭐 하면서 놀까?',
    ])
    npcIds.forEach(npcId => {
      expect(VILLAGER_FIRST_GREETING[npcId]).toHaveLength(2)
    })

    expect(serializedGreetings).not.toContain('왔네')
    expect(serializedGreetings).not.toContain('들렀구나')
    expect(serializedGreetings).not.toContain('들어줄게')
    expect(serializedGreetings).not.toContain('주사')
    expect(serializedGreetings).not.toContain('검사')
    expect(serializedGreetings).not.toContain('아픔')
    expect(serializedGreetings).not.toContain('가족 걱정')
  })

  it('uses one neutral entry script for every villager', () => {
    expect(SHARED_COUNSELING_SCRIPTS).toHaveLength(1)
    expect(SHARED_COUNSELING_SCRIPTS[0].scriptId).toBe(VILLAGER_COUNSELING_SCRIPT.scriptId)

    const script = SHARED_COUNSELING_SCRIPTS[0]
    const entryNode = script.nodes[script.startNodeId]

    expect(script.scriptId).toBe('villager_common_entry')
    expect(script.startNodeId).toBe('entry_01')
    expect(entryNode.questionText).toBe('오늘은 어떻게 지내고 싶어?')
    expect(entryNode.choices.map(choice => choice.text)).toEqual([
      '쉬면서 있고 싶어요',
      '뭔가 해보고 싶어요',
      '잠깐 얘기하고 싶어요',
    ])
  })

  it('keeps hospital and family worry topics behind the child-selected worry route', () => {
    const script = SHARED_COUNSELING_SCRIPTS[0]
    const entrySerialized = JSON.stringify(script.nodes.entry_01)

    expect(entrySerialized).not.toContain('주사')
    expect(entrySerialized).not.toContain('검사')
    expect(entrySerialized).not.toContain('아픈')
    expect(entrySerialized).not.toContain('가족이 걱정')

    expect(
      script.nodes.entry_01.choices.find(choice => choice.choiceIntentId === 'entry_talk')
        ?.nextNodeId,
    ).toBe('talk_topic_01')
    expect(
      script.nodes.talk_topic_01.choices.find(choice => choice.choiceIntentId === 'talk_worry')
        ?.nextNodeId,
    ).toBe('worry_01')
    expect(
      script.nodes.worry_01.choices.find(choice => choice.choiceIntentId === 'worry_hospital')
        ?.nextNodeId,
    ).toBe('hospital_02')
    expect(script.nodes.hospital_02.choices.map(choice => choice.text)).toContain('주사가 걱정돼요')
  })

  it('keeps every choice valid and every terminal choice explicitly closeable', () => {
    const script = SHARED_COUNSELING_SCRIPTS[0]

    Object.values(script.nodes).forEach(node => {
      expect(node.choices.length).toBeGreaterThan(0)
      expect(node.choices.length).toBeLessThanOrEqual(3)

      node.choices.forEach(choice => {
        expect(choice.choiceIntentId).toBeTruthy()
        expect(choice.text).toBeTruthy()
        expect(choice.fallbackResponseLines.length).toBeGreaterThan(0)
        expect([0, 1, 2, 3]).toContain(choice.intensity)
        expect(Array.isArray(choice.concernFlags)).toBe(true)
        expect(Array.isArray(choice.protectiveFactors)).toBe(true)

        if (!choice.nextNodeId || choice.endAfterSelect) {
          expect(choice.endingType).toBeTruthy()
          expect(
            buildActivityAwareEndingLines({
              endingType: choice.endingType,
              npcId: 'nurse_bunny',
              dailyActivityState: {
                completedActivityCount: 0,
                hasDoneAnyActivityToday: false,
                recommendedActivityLabel: '가벼운 활동',
              },
            }).length,
          ).toBeGreaterThan(0)
        }
      })
    })
  })

  it('returns npc-specific response variants when available', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    expect(
      getVillagerLines({
        npcId: 'monkey_friend',
        key: 'entry_activity',
        fallback: ['fallback'],
      }),
    ).toEqual(['좋아! 코몽이랑 살짝 해보자!', '힘들면 바로 멈추기 약속!'])

    expect(
      getVillagerLines({
        npcId: 'dain',
        key: 'entry_activity',
        fallback: ['fallback'],
      }),
    ).toEqual(['좋아. 가볍게 하나 해보자.', '재밌는 거면 더 좋고!'])

    vi.restoreAllMocks()
  })

  it('does not use burdening or diagnostic wording in shared static villager scripts', () => {
    const serialized = JSON.stringify({
      scripts: SHARED_COUNSELING_SCRIPTS,
      greetings: VILLAGER_FIRST_GREETING,
      lines: npcIds.map(npcId =>
        getVillagerLines({ npcId, key: 'entry_rest', fallback: ['fallback'] }),
      ),
    })

    expect(serialized).not.toContain('열심히')
    expect(serialized).not.toContain('꼭')
    expect(serialized).not.toContain('해야 해')
    expect(serialized).not.toContain('참아야')
    expect(serialized).not.toContain('이겨내야')
    expect(serialized).not.toContain('진단')
    expect(serialized).not.toContain('위험')
    expect(serialized).not.toContain('치료 필요')
    expect(serialized).not.toContain('심각')
  })
})
