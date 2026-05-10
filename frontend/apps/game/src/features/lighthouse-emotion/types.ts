export type LighthouseDialogueStatus =
  | 'idle'
  | 'starting'
  | 'waiting_choice'
  | 'submitting_choice'
  | 'showing_response'
  | 'closing'
  | 'finished'
  | 'error'

export interface EmotionChoiceViewModel {
  choiceIntentId: string
  text: string
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
  npcId: 'lighthouse_keeper'
  mode: 'LIGHTHOUSE_LLM'
}

export interface StartLighthouseEmotionResponse {
  sessionId: string
  status: 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED'
  scene: EmotionSceneViewModel
}

export interface SubmitLighthouseTurnRequest {
  selectedChoice: EmotionChoiceViewModel
}

export interface SubmitLighthouseTurnResponse {
  npcResponse?: string[]
  nextScene: EmotionSceneViewModel
  closingLines?: string[]
}

export interface FinishLighthouseEmotionRequest {
  finishReason: 'COMPLETED' | 'REST' | 'MAX_STEPS' | 'CANCELLED' | 'ERROR'
}

export interface FinishLighthouseEmotionResponse {
  sessionId: string
  status: 'FINISHED' | 'CANCELLED'
  closingLines: string[]
  reportUpdated?: boolean
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
