export type VillagerNpcId =
  | 'nurse_bunny'
  | 'sleepy_sheep'
  | 'gardener_bear'
  | 'monkey_friend'
  | 'squirrel_friend'
  | 'dain'

export type VillagerDialogueStatus =
  | 'idle'
  | 'opening'
  | 'waiting_choice'
  | 'submitting_choice'
  | 'showing_response'
  | 'closing'
  | 'finished'
  | 'error'

export interface VillagerChoice {
  choiceIntentId: string
  text: string
  nextSceneId: string | null
  intensity: 0 | 1 | 2 | 3
  concernFlags: string[]
  protectiveFactors: string[]
  npcResponse: string
}

export interface VillagerScene {
  sceneId: string
  questionText: string
  choices: VillagerChoice[]
}

export interface VillagerDialogueScript {
  npcId: VillagerNpcId
  npcName: string
  theme: string
  greetingLine: string
  closingLine: string
  scenes: VillagerScene[]
}

export interface VillagerChoiceEvent {
  sessionId: string
  npcId: VillagerNpcId
  sceneId: string
  questionText: string
  choiceIntentId: string
  choiceText: string
  intensity: 0 | 1 | 2 | 3
  concernFlags: string[]
  protectiveFactors: string[]
  generatedBy: 'STATIC'
  createdAt: string
}

export type VillagerDialogueOpenPayload = {
  npcId: VillagerNpcId
}
