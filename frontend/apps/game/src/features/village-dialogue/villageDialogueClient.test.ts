import { afterEach, describe, expect, it, vi } from 'vitest'
import { cancelVillagerDialogueSession, saveVillagerChoiceEvent } from './villageDialogueClient'
import type { VillagerChoiceEvent } from './types'

const baseEvent: VillagerChoiceEvent = {
  sessionId: '42',
  clientEventId: 'event-1',
  npcId: 'monkey_friend',
  displayName: '코몽',
  npcName: 'SEORIN',
  sceneId: 'monkey_friend_01_move',
  nodeId: 'monkey_friend_01_move',
  questionText: '지금 움직이고 싶어?',
  choiceIntentId: 'monkey_move_little',
  choiceText: '조금 움직일래요',
  intensity: 0,
  concernFlags: [],
  protectiveFactors: ['playful_coping', 'agency_coping'],
  generatedBy: 'STATIC',
  createdAt: '2026-05-11T00:00:00.000Z',
}

describe('saveVillagerChoiceEvent', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('stores displayName and backend npcName separately in localStorage', async () => {
    await saveVillagerChoiceEvent(baseEvent)

    const events = JSON.parse(localStorage.getItem('villager_dialogue_events') ?? '[]')
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      npcId: 'monkey_friend',
      displayName: '코몽',
      npcName: 'SEORIN',
    })
  })

  it('sends backend enum npcName in backend mode payload', async () => {
    vi.stubEnv('VITE_VILLAGE_DIALOGUE_SAVE_MODE', 'backend')
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response)
    vi.stubGlobal('fetch', fetchMock)

    await saveVillagerChoiceEvent(baseEvent)

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/dialogue/sessions/42/turns', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        clientEventId: 'event-1',
        npcId: 'monkey_friend',
        npcName: 'SEORIN',
        questionText: '지금 움직이고 싶어?',
        sceneId: 'monkey_friend_01_move',
        nodeId: 'monkey_friend_01_move',
        topicId: undefined,
        selectedChoice: {
          choiceIntentId: 'monkey_move_little',
          text: '조금 움직일래요',
        },
        intensity: 0,
        concernFlags: [],
        protectiveFactors: ['playful_coping', 'agency_coping'],
        generatedBy: 'STATIC',
      }),
    })
  })

  it('stores cancelled session status locally', async () => {
    await cancelVillagerDialogueSession('session-1')

    const sessions = JSON.parse(localStorage.getItem('villager_dialogue_sessions') ?? '[]')
    expect(sessions[0]).toMatchObject({
      sessionId: 'session-1',
      status: 'CANCELLED',
    })
  })
})
