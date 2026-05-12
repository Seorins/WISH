import type { BackendNpcName, FrontNpcId } from '../npcIdentity'

export type VillagerNpcId =
  | 'nurse_bunny'
  | 'sleepy_sheep'
  | 'gardener_bear'
  | 'monkey_friend'
  | 'squirrel_friend'
  | 'dain'

export interface VillagerIdentity {
  npcId: VillagerNpcId
  displayName: string
  backendNpcName: Exclude<BackendNpcName, 'YEONGCHEOL'>
}

export type VillagerDialogueStatus =
  | 'idle'
  | 'opening_greeting'
  | 'waiting_choice'
  | 'submitting_choice'
  | 'showing_response'
  | 'waiting_final_close'
  | 'finished'
  | 'error'

export type CounselingEndingType =
  | 'GO_LIGHT_ACTIVITY'
  | 'REST_THEN_ACTIVITY'
  | 'REST_ONLY'
  | 'ASK_HELP_FIRST'
  | 'ASK_ADULT_FIRST'
  | 'ASK_MEDICAL_FIRST'
  | 'EXPRESS_WITH_DRAWING'
  | 'SOCIAL_CONNECT'
  | 'PRIVATE_OKAY'
  | 'CALM_DOWN'
  | 'NO_PRESSURE'

export interface DailyActivityState {
  completedActivityCount: number
  hasDoneAnyActivityToday: boolean
  hasCompletedAllRecommendedActivities?: boolean
  recommendedActivityLabel?: string
}

export interface CounselingChoice {
  choiceIntentId: string
  text: string
  nextNodeId: string | null
  endAfterSelect?: boolean
  intensity: 0 | 1 | 2 | 3
  concernFlags: string[]
  protectiveFactors: string[]
  responseLines: string[]
  endingType?: CounselingEndingType
  endingLines?: string[]
  activityEndingLines?: {
    pending: string[]
    completed: string[]
  }
}

export interface CounselingNode {
  nodeId: string
  questionText: string
  choices: CounselingChoice[]
}

export interface CounselingScript {
  scriptId: string
  title: string
  domain: 'body' | 'pain' | 'fatigue' | 'family' | 'peer' | 'expression' | 'anger'
  weight?: number
  fallbackEndingLine?: string
  startNodeId: string
  nodes: Record<string, CounselingNode>
}

export type VillagerChoice = CounselingChoice
export type VillagerDialogueNode = CounselingNode

export interface VillagerDialogueScript extends VillagerIdentity {
  theme: string
}

export interface VillagerChoiceEvent {
  sessionId: string | number
  clientEventId?: string
  npcId: FrontNpcId
  displayName: string
  npcName: BackendNpcName
  topicId?: string
  sceneId: string
  nodeId?: string
  questionText: string
  choiceIntentId: string
  choiceText: string
  intensity: 0 | 1 | 2 | 3
  concernFlags: string[]
  protectiveFactors: string[]
  generatedBy: 'STATIC' | 'CLAUDE' | 'FALLBACK'
  createdAt: string
}

export type VillagerDialogueOpenPayload = {
  npcId: VillagerNpcId
}
