import type { BackendNpcName, FrontNpcId } from '../npcIdentity'

export type LighthouseDialogueStatus =
  | 'idle'
  | 'starting'
  | 'waiting_choice'
  | 'submitting_choice'
  | 'loading_next'
  | 'showing_response'
  | 'finishing'
  | 'showing_closing'
  | 'finished'
  | 'error'

export interface EmotionChoiceViewModel {
  choiceIntentId: string
  text: string
  intensity?: number
  concernFlags?: string[]
  protectiveFactors?: string[]
}

export interface EmotionSceneViewModel {
  sceneId?: string | null
  questionText: string
  choices: EmotionChoiceViewModel[]
  secondaryAction: EmotionChoiceViewModel | null
  shouldEndSession: boolean
  reasonCode?: string
  generatedBy?: 'CLAUDE' | 'FALLBACK' | 'STATIC'
}

export interface StartLighthouseEmotionRequest {
  patientProfileId: number
  npcName: Extract<BackendNpcName, 'YEONGCHEOL'>
}

export interface StartLighthouseEmotionResponse {
  sessionId: string
  status: 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED'
  scene: EmotionSceneViewModel
}

export interface StartLighthouseEmotionApiResponse {
  code: string
  message: string
  data: {
    sessionId: number
    status: 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED'
    scene: EmotionSceneViewModel | null
  }
  errors?: Record<string, string>
}

export interface SubmitLighthouseTurnRequest {
  questionText: string
  selectedChoice: EmotionChoiceViewModel
}

export interface SubmitLighthouseTurnResponse {
  npcResponse?: string[]
  nextScene: EmotionSceneViewModel
  closingLines?: string[]
}

export interface SubmitLighthouseTurnApiResponse {
  code: string
  message: string
  data: {
    sessionId: number
    status: 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED'
    nextScene: EmotionSceneViewModel
  } | null
  errors?: Record<string, string>
}

export interface FinishLighthouseEmotionRequest {
  finishReason: 'COMPLETED' | 'REST' | 'MAX_STEPS' | 'CANCELLED' | 'ERROR'
}

export interface FinishLighthouseEmotionResponse {
  sessionId: string
  status: 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED'
  closingLines: string[]
  reportUpdated?: boolean
}

export interface DialogueTurnDetail {
  id: number
  stepIndex: number
  questionText: string
  choiceIntentId: string
  choiceText: string
  intensity: number
  concernFlags: string[]
  protectiveFactors: string[]
  generatedBy: 'CLAUDE' | 'FALLBACK' | 'STATIC'
  createdAt: string
}

export interface DialogueSessionDetail {
  sessionId: number
  patientProfileId: number
  npcId?: FrontNpcId
  npcName: BackendNpcName | string
  status: 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED'
  stepCount: number
  maxSteps: number
  finishReason: FinishLighthouseEmotionRequest['finishReason'] | null
  startedAt: string
  endedAt: string | null
  turns: DialogueTurnDetail[]
}

export interface DialogueSessionDetailApiResponse {
  code: string
  message: string
  data: DialogueSessionDetail | null
  errors?: Record<string, string>
}

export interface FinishLighthouseEmotionApiResponse {
  code: string
  message: string
  data: {
    sessionId: number
    status: 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED'
    closingLines: string[]
  } | null
  errors?: Record<string, string>
}

export interface LighthouseEmotionState {
  sessionId: string | null
  status: LighthouseDialogueStatus
  currentScene: EmotionSceneViewModel | null
  npcResponseLines: string[]
  closingLines: string[]
  selectedChoiceIntentId: string | null
  stepCount: number
  errorMessage: string | null
}
