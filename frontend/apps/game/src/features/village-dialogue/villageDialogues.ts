import type { VillagerDialogueScript, VillagerIdentity, VillagerNpcId } from './types'

export const VILLAGER_IDENTITIES: Record<VillagerNpcId, VillagerIdentity> = {
  nurse_bunny: {
    npcId: 'nurse_bunny',
    displayName: '간호사 조은',
    backendNpcName: 'JOEUN',
  },
  sleepy_sheep: {
    npcId: 'sleepy_sheep',
    displayName: '건빈',
    backendNpcName: 'GEONBIN',
  },
  gardener_bear: {
    npcId: 'gardener_bear',
    displayName: '정호',
    backendNpcName: 'JEONGHO',
  },
  monkey_friend: {
    npcId: 'monkey_friend',
    displayName: '코몽',
    backendNpcName: 'SEORIN',
  },
  squirrel_friend: {
    npcId: 'squirrel_friend',
    displayName: '세현',
    backendNpcName: 'SEHYEON',
  },
  dain: {
    npcId: 'dain',
    displayName: '다인',
    backendNpcName: 'DAIN',
  },
}

export const VILLAGER_FIRST_GREETING: Record<VillagerNpcId, string[]> = {
  nurse_bunny: ['안녕, 왔네.', '잠깐 쉬어가도 돼.'],
  sleepy_sheep: ['안녕, 왔어?', '나도 잠깐 쉬고 있었어.'],
  gardener_bear: ['안녕, 왔네.', '여기 조용해서 쉬기 좋아.'],
  monkey_friend: ['오! 왔네.', '잠깐 같이 있어도 좋아.'],
  squirrel_friend: ['안녕, 왔구나.', '괜찮으면 잠깐 얘기하자.'],
  dain: ['안녕! 왔네.', '같이 잠깐 얘기할래?'],
}

export const villageDialogues: Record<VillagerNpcId, VillagerDialogueScript> = {
  nurse_bunny: {
    ...VILLAGER_IDENTITIES.nurse_bunny,
    theme: '몸 상태와 도움 요청',
  },
  sleepy_sheep: {
    ...VILLAGER_IDENTITIES.sleepy_sheep,
    theme: '피로와 휴식',
  },
  gardener_bear: {
    ...VILLAGER_IDENTITIES.gardener_bear,
    theme: '마음 표현과 작은 대처',
  },
  monkey_friend: {
    ...VILLAGER_IDENTITIES.monkey_friend,
    theme: '기분 전환과 감정 조절',
  },
  squirrel_friend: {
    ...VILLAGER_IDENTITIES.squirrel_friend,
    theme: '걱정과 관계',
  },
  dain: {
    ...VILLAGER_IDENTITIES.dain,
    theme: '또래 관계와 마음 전하기',
  },
}
