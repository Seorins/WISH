import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createLighthouseEntryScene,
  finishLighthouseEmotionSession,
  LIGHTHOUSE_ENTRY_QUESTION,
  startLighthouseEmotionSession,
  submitLighthouseEmotionTurn,
} from './lighthouseEmotionClient'
import type {
  DailyActivityState,
  EmotionChoiceViewModel,
  EmotionSceneViewModel,
  FinishLighthouseEmotionRequest,
  LighthouseEmotionState,
  SubmitLighthouseTurnResponse,
} from './types'

const RESPONSE_DELAY_MS = 1700
const LLM_REWRITE_WAIT_MS = 650

export const LIGHTHOUSE_OPENING_WELCOME_LINES = [
  '어서 와, 기다리고 있었단다.',
  '우리만의 작은 등대에 온 걸 환영해.',
]

export const LIGHTHOUSE_OPENING_SAFE_LINES = ['여기서는 천천히 쉬어도 괜찮아.']
export const LIGHTHOUSE_LOADING_LINE = '등대지기가 불빛을 살피고 있어요...'

const SAFE_ERROR_LINES = ['괜찮아. 잠시 후 다시 이야기해보자.']
const SAFE_EMPTY_LINE = '괜찮아. 천천히 말해도 된단다.'
const SAFE_CLOSING_LINES = ['오늘은 여기까지 해도 괜찮아.', '등대 불빛은 천천히 쉬고 있을게.']

type LighthouseStaticNode = {
  nodeId: string
  questionText: string
  choices: EmotionChoiceViewModel[]
}

const LIGHTHOUSE_STATIC_SCRIPT: Record<string, LighthouseStaticNode> = {
  entry_01: {
    nodeId: 'entry_01',
    questionText: LIGHTHOUSE_ENTRY_QUESTION,
    choices: createLighthouseEntryScene().choices,
  },
  rest_01: {
    nodeId: 'rest_01',
    questionText: '어떻게 쉬고 싶니?',
    choices: [
      {
        choiceIntentId: 'rest_quiet',
        text: '조용히 있을래요',
        nextNodeId: null,
        endAfterSelect: true,
        intensity: 1,
        concernFlags: ['needs_rest'],
        protectiveFactors: ['sets_boundary'],
        responseLines: ['그래. 조용히 있어도 괜찮아.', '말을 많이 하지 않아도 돼.'],
      },
      {
        choiceIntentId: 'rest_close_eyes',
        text: '눈을 감고 있을래요',
        nextNodeId: null,
        endAfterSelect: true,
        intensity: 1,
        concernFlags: ['fatigue_present'],
        protectiveFactors: ['self_care_action'],
        responseLines: ['눈을 잠깐 감는 것도 쉬는 방법이야.', '조금 편해질 때까지 기다려도 돼.'],
      },
      {
        choiceIntentId: 'rest_near_family',
        text: '가족 옆에 있을래요',
        nextNodeId: null,
        endAfterSelect: true,
        intensity: 0,
        concernFlags: [],
        protectiveFactors: ['family_support_preference'],
        responseLines: ['편한 사람 옆에 있으면 마음이 쉬기 쉬워.', '그렇게 쉬어도 괜찮아.'],
      },
    ],
  },
  activity_01: {
    nodeId: 'activity_01',
    questionText: '가볍게 뭘 해볼까?',
    choices: [
      {
        choiceIntentId: 'activity_music',
        text: '음악을 들어볼래요',
        nextNodeId: null,
        endAfterSelect: true,
        intensity: 0,
        concernFlags: [],
        protectiveFactors: ['music_interest'],
        responseLines: ['좋아. 듣는 것부터 시작해도 돼.', '짧게 들어도 충분해.'],
      },
      {
        choiceIntentId: 'activity_art',
        text: '그림을 그려볼래요',
        nextNodeId: null,
        endAfterSelect: true,
        intensity: 0,
        concernFlags: [],
        protectiveFactors: ['creative_expression'],
        responseLines: ['그림은 말보다 편할 때가 있어.', '생각나는 것만 그려도 돼.'],
      },
      {
        choiceIntentId: 'activity_move',
        text: '조금 움직여볼래요',
        nextNodeId: null,
        endAfterSelect: true,
        intensity: 0,
        concernFlags: [],
        protectiveFactors: ['movement_interest'],
        responseLines: ['좋아. 아주 조금만 움직여도 괜찮아.', '힘들면 멈춰도 돼.'],
      },
    ],
  },
  talk_topic_01: {
    nodeId: 'talk_topic_01',
    questionText: '무슨 얘기가 좋을까?',
    choices: [
      {
        choiceIntentId: 'talk_body',
        text: '몸 얘기',
        nextNodeId: 'body_01',
        intensity: 0,
        concernFlags: [],
        protectiveFactors: ['body_checkin_interest'],
        responseLines: ['좋아. 몸이 어떤지 잠깐만 살펴보자.', '짧게 골라도 괜찮아.'],
      },
      {
        choiceIntentId: 'talk_peer',
        text: '친구나 학교 얘기',
        nextNodeId: 'peer_01',
        intensity: 0,
        concernFlags: [],
        protectiveFactors: ['social_connection_interest'],
        responseLines: ['친구나 학교 생각이 나는 날도 있지.', '편한 것부터 이야기해보자.'],
      },
      {
        choiceIntentId: 'talk_worry',
        text: '걱정되는 얘기',
        nextNodeId: 'worry_01',
        intensity: 1,
        concernFlags: ['worry_present'],
        protectiveFactors: ['emotion_named'],
        responseLines: [
          '그래, 걱정되는 게 있으면 조금만 말해도 돼.',
          '말하기 싫은 건 괜찮다고 해도 돼.',
        ],
      },
    ],
  },
  body_01: {
    nodeId: 'body_01',
    questionText: '지금 몸은 어때?',
    choices: [
      {
        choiceIntentId: 'body_okay',
        text: '괜찮아요',
        nextNodeId: null,
        endAfterSelect: true,
        intensity: 0,
        concernFlags: [],
        protectiveFactors: ['positive_body_state'],
        responseLines: ['좋아. 지금은 괜찮구나.', '불편해지면 바로 말해도 돼.'],
      },
      {
        choiceIntentId: 'body_tired',
        text: '금방 힘이 빠져요',
        nextNodeId: 'rest_01',
        intensity: 2,
        concernFlags: ['fatigue_present'],
        protectiveFactors: ['body_state_named'],
        responseLines: ['힘이 금방 빠지는 날도 있어.', '그럴 땐 쉬어도 괜찮아.'],
      },
      {
        choiceIntentId: 'body_pain_worry',
        text: '아픈 게 걱정돼요',
        nextNodeId: 'pain_01',
        intensity: 3,
        concernFlags: ['pain_concern'],
        protectiveFactors: ['can_name_fear'],
        responseLines: ['아픈 게 걱정되면 혼자 참지 않아도 돼.', '어떻게 알려줄지 같이 골라보자.'],
      },
    ],
  },
  pain_01: {
    nodeId: 'pain_01',
    questionText: '아플 때는 어떻게 알려줄까?',
    choices: [
      {
        choiceIntentId: 'pain_tell_teacher',
        text: '선생님께 말할래요',
        nextNodeId: null,
        endAfterSelect: true,
        intensity: 0,
        concernFlags: [],
        protectiveFactors: ['medical_support_preference', 'support_seeking'],
        responseLines: ['좋아. 선생님께 말하면 도와줄 수 있어.', '작은 아픔도 말해도 돼.'],
      },
      {
        choiceIntentId: 'pain_point_place',
        text: '아픈 곳을 가리킬래요',
        nextNodeId: null,
        endAfterSelect: true,
        intensity: 1,
        concernFlags: ['prefers_nonverbal_expression'],
        protectiveFactors: ['alternative_expression'],
        responseLines: ['손으로 알려줘도 괜찮아.', '말이 안 나올 때는 그 방법도 좋아.'],
      },
      {
        choiceIntentId: 'pain_hold_hand',
        text: '손을 잡아줬으면 해요',
        nextNodeId: null,
        endAfterSelect: true,
        intensity: 1,
        concernFlags: ['needs_comfort'],
        protectiveFactors: ['comfort_preference_named'],
        responseLines: ['손을 잡아달라고 해도 괜찮아.', '그게 조금 든든할 때도 있어.'],
      },
    ],
  },
  peer_01: {
    nodeId: 'peer_01',
    questionText: '친구나 학교 생각이 나?',
    choices: [
      {
        choiceIntentId: 'peer_miss',
        text: '친구가 보고 싶어요',
        nextNodeId: null,
        endAfterSelect: true,
        intensity: 2,
        concernFlags: ['peer_separation'],
        protectiveFactors: ['relationship_named'],
        responseLines: ['친구가 보고 싶은 마음이 들 수 있어.', '짧게 인사만 해도 괜찮아.'],
      },
      {
        choiceIntentId: 'peer_school',
        text: '학교 소식이 궁금해요',
        nextNodeId: null,
        endAfterSelect: true,
        intensity: 1,
        concernFlags: ['school_connection'],
        protectiveFactors: ['information_seeking'],
        responseLines: ['학교 소식이 궁금할 수 있어.', '천천히 들어도 괜찮아.'],
      },
      {
        choiceIntentId: 'peer_okay',
        text: '지금은 괜찮아요',
        nextNodeId: null,
        endAfterSelect: true,
        intensity: 0,
        concernFlags: [],
        protectiveFactors: ['positive_social_state'],
        responseLines: ['좋아. 지금은 괜찮구나.', '필요하면 나중에 다시 이야기해도 돼.'],
      },
    ],
  },
  worry_01: {
    nodeId: 'worry_01',
    questionText: '어떤 게 제일 신경 쓰여?',
    choices: [
      {
        choiceIntentId: 'worry_hospital',
        text: '병원 일이 걱정돼요',
        nextNodeId: 'hospital_01',
        intensity: 2,
        concernFlags: ['hospital_worry'],
        protectiveFactors: ['emotion_named'],
        responseLines: ['병원 일이 신경 쓰일 수 있어.', '말하기 싫으면 괜찮다고 해도 돼.'],
      },
      {
        choiceIntentId: 'worry_family',
        text: '가족이 걱정돼요',
        nextNodeId: 'family_01',
        intensity: 3,
        concernFlags: ['family_worry'],
        protectiveFactors: ['relationship_named'],
        responseLines: ['가족이 걱정될 때도 있지.', '혼자만 걱정하지 않아도 돼.'],
      },
      {
        choiceIntentId: 'worry_upset',
        text: '속상한 일이 있어요',
        nextNodeId: 'upset_01',
        intensity: 2,
        concernFlags: ['distress_present'],
        protectiveFactors: ['emotion_named'],
        responseLines: ['속상한 일이 있었구나.', '지금 바로 다 말하지 않아도 돼.'],
      },
    ],
  },
  hospital_01: {
    nodeId: 'hospital_01',
    questionText: '어떤 게 조금 걸려?',
    choices: [
      {
        choiceIntentId: 'hospital_injection',
        text: '주사가 걱정돼요',
        nextNodeId: null,
        endAfterSelect: true,
        intensity: 3,
        concernFlags: ['procedure_fear'],
        protectiveFactors: ['can_name_fear'],
        responseLines: ['주사가 걱정될 수 있어.', '그럴 땐 혼자 참지 않아도 돼.'],
      },
      {
        choiceIntentId: 'hospital_unknown',
        text: '어떻게 하는지 모르겠어요',
        nextNodeId: null,
        endAfterSelect: true,
        intensity: 2,
        concernFlags: ['uncertainty'],
        protectiveFactors: ['information_seeking'],
        responseLines: ['모르면 더 걱정될 수 있어.', '물어보는 건 괜찮은 일이야.'],
      },
      {
        choiceIntentId: 'hospital_okay',
        text: '지금은 괜찮아요',
        nextNodeId: null,
        endAfterSelect: true,
        intensity: 0,
        concernFlags: [],
        protectiveFactors: ['positive_mood'],
        responseLines: ['좋아. 지금은 괜찮구나.', '필요하면 나중에 다시 말해도 돼.'],
      },
    ],
  },
  family_01: {
    nodeId: 'family_01',
    questionText: '그럴 땐 누구에게 말하면 좋을까?',
    choices: [
      {
        choiceIntentId: 'family_say_worry',
        text: '가족에게 말할래요',
        nextNodeId: null,
        endAfterSelect: true,
        intensity: 0,
        concernFlags: [],
        protectiveFactors: ['family_support_preference'],
        responseLines: ['걱정된다고 말해도 괜찮아.', '짧게 말해도 마음이 전해질 수 있어.'],
      },
      {
        choiceIntentId: 'family_tell_teacher',
        text: '선생님께 말할래요',
        nextNodeId: null,
        endAfterSelect: true,
        intensity: 0,
        concernFlags: [],
        protectiveFactors: ['support_seeking'],
        responseLines: ['선생님께 말하면 같이 도와줄 수 있어.', '혼자 들고 있지 않아도 돼.'],
      },
      {
        choiceIntentId: 'family_show_drawing',
        text: '그림으로 보여줄래요',
        nextNodeId: null,
        endAfterSelect: true,
        intensity: 0,
        concernFlags: ['prefers_nonverbal_expression'],
        protectiveFactors: ['creative_expression'],
        responseLines: ['그림으로 보여줘도 괜찮아.', '말보다 그림이 편한 날도 있어.'],
      },
    ],
  },
  upset_01: {
    nodeId: 'upset_01',
    questionText: '그럴 땐 어떻게 하고 싶어?',
    choices: [
      {
        choiceIntentId: 'anger_pause',
        text: '잠깐 멈출래요',
        nextNodeId: null,
        endAfterSelect: true,
        intensity: 1,
        concernFlags: ['anger_or_frustration'],
        protectiveFactors: ['pause_coping'],
        responseLines: ['좋아. 잠깐 멈추는 것도 방법이야.', '천천히 다시 해도 돼.'],
      },
      {
        choiceIntentId: 'anger_say_upset',
        text: '속상하다고 말할래요',
        nextNodeId: null,
        endAfterSelect: true,
        intensity: 1,
        concernFlags: ['anger_or_frustration'],
        protectiveFactors: ['verbal_expression'],
        responseLines: ['속상하다고 말해도 괜찮아.', '말하면 조금 덜 답답할 수 있어.'],
      },
      {
        choiceIntentId: 'anger_call_help',
        text: '도와달라고 말할래요',
        nextNodeId: null,
        endAfterSelect: true,
        intensity: 1,
        concernFlags: ['anger_or_frustration'],
        protectiveFactors: ['support_seeking'],
        responseLines: ['도와달라고 말해도 괜찮아.', '혼자 하기 어려울 땐 도움을 받아도 돼.'],
      },
    ],
  },
}

const initialState: LighthouseEmotionState = {
  sessionId: null,
  status: 'idle',
  currentScene: null,
  currentNodeId: null,
  npcResponseLines: [],
  closingLines: [],
  selectedChoiceIntentId: null,
  stepCount: 0,
  errorMessage: null,
}

function wait(delayMs: number) {
  return new Promise<void>(resolve => {
    window.setTimeout(resolve, delayMs)
  })
}

function getSafeLines(lines: unknown, fallback: string[]) {
  if (!Array.isArray(lines)) return fallback
  const safeLines = lines.filter(line => typeof line === 'string' && line.trim().length > 0)
  return safeLines.length > 0 ? safeLines.slice(0, 2) : fallback
}

function getTodayActivityState(): DailyActivityState {
  return {
    hasDoneAnyActivityToday: false,
    completedActivityCount: 0,
    recommendedActivityLabel: '가벼운 활동',
  }
}

function createSceneFromNode(node: LighthouseStaticNode): EmotionSceneViewModel {
  return {
    sceneId: node.nodeId,
    questionText: node.questionText,
    choices: node.choices,
    secondaryAction: null,
    shouldEndSession: false,
    generatedBy: 'STATIC',
  }
}

function getNode(nodeId: string | null | undefined) {
  return nodeId ? LIGHTHOUSE_STATIC_SCRIPT[nodeId] : null
}

function hasUnsafeWords(lines: string[]) {
  const text = lines.join(' ')
  return [
    'LLM',
    'AI',
    'API',
    '서버',
    '모델',
    '진단',
    '위험',
    '심각',
    '죽음',
    '예후',
    '생존',
    '참아야',
    '이겨내야',
  ].some(word => text.includes(word))
}

function getValidatedRewriteLines(response: SubmitLighthouseTurnResponse, fallback: string[]) {
  const lines = getSafeLines(response.npcResponse, [])
  if (lines.length === 0) return fallback
  if (hasUnsafeWords(lines)) return fallback
  return lines
}

function createResponseRewriteRequest(
  choice: EmotionChoiceViewModel,
  currentQuestionText: string,
  nextNode: LighthouseStaticNode | null,
) {
  return {
    questionText: currentQuestionText,
    route: nextNode?.nodeId ?? 'end',
    historyIntentIds: [choice.choiceIntentId],
    previousQuestionTexts: [currentQuestionText],
    dailyActivityState: getTodayActivityState(),
    selectedChoice: {
      choiceIntentId: choice.choiceIntentId,
      text: choice.text,
      intensity: choice.intensity ?? 0,
      concernFlags: choice.concernFlags ?? [],
      protectiveFactors: choice.protectiveFactors ?? [],
    },
  }
}

export function useLighthouseEmotionSession({
  patientProfileId,
  onFinished,
}: {
  patientProfileId: number
  onFinished?: () => void
}) {
  const sessionIdRef = useRef<string | null>(null)
  const startInFlightRef = useRef(false)
  const isMountedRef = useRef(true)
  const requestSeqRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const [state, setState] = useState<LighthouseEmotionState>(initialState)

  const abortActiveRequest = useCallback(() => {
    requestSeqRef.current += 1
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
  }, [])

  const close = useCallback(() => {
    abortActiveRequest()
    sessionIdRef.current = null
    startInFlightRef.current = false
    setState({
      ...initialState,
      status: 'finished',
    })
    onFinished?.()
  }, [abortActiveRequest, onFinished])

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
      abortActiveRequest()
    }
  }, [abortActiveRequest])

  const finish = useCallback(
    async (
      finishReason: FinishLighthouseEmotionRequest['finishReason'] = 'COMPLETED',
      sessionIdOverride?: string,
    ) => {
      const targetSessionId = sessionIdOverride ?? sessionIdRef.current
      if (!targetSessionId) {
        setState(prev => ({
          ...prev,
          status: 'waiting_final_close',
          closingLines: SAFE_CLOSING_LINES,
          currentScene: null,
          currentNodeId: null,
          npcResponseLines: [],
          selectedChoiceIntentId: null,
        }))
        return
      }

      const requestSeq = ++requestSeqRef.current
      const controller = new AbortController()
      abortControllerRef.current?.abort()
      abortControllerRef.current = controller

      try {
        const result = await finishLighthouseEmotionSession(
          targetSessionId,
          finishReason,
          controller.signal,
        )
        if (!isMountedRef.current || requestSeq !== requestSeqRef.current) return

        setState(prev => ({
          ...prev,
          status: 'waiting_final_close',
          closingLines: getSafeLines(result.closingLines, SAFE_CLOSING_LINES),
          currentScene: null,
          currentNodeId: null,
          npcResponseLines: [],
          selectedChoiceIntentId: null,
        }))
      } catch {
        if (controller.signal.aborted || !isMountedRef.current) return
        setState(prev => ({
          ...prev,
          status: 'waiting_final_close',
          closingLines: SAFE_CLOSING_LINES,
          currentScene: null,
          currentNodeId: null,
          npcResponseLines: [],
          selectedChoiceIntentId: null,
        }))
      }
    },
    [],
  )

  const start = useCallback(async () => {
    if (startInFlightRef.current || sessionIdRef.current) return
    if (!Number.isInteger(patientProfileId) || patientProfileId <= 0) return

    const requestSeq = ++requestSeqRef.current
    const controller = new AbortController()
    abortControllerRef.current?.abort()
    abortControllerRef.current = controller

    setState(prev => ({
      ...prev,
      status: 'opening_welcome',
      currentScene: createSceneFromNode(LIGHTHOUSE_STATIC_SCRIPT.entry_01),
      currentNodeId: 'entry_01',
      errorMessage: null,
      selectedChoiceIntentId: null,
      npcResponseLines: [],
      closingLines: [],
    }))

    try {
      startInFlightRef.current = true
      const result = await startLighthouseEmotionSession(patientProfileId, controller.signal)
      if (!isMountedRef.current || requestSeq !== requestSeqRef.current) return

      sessionIdRef.current = result.sessionId
      setState(prev => ({
        ...prev,
        sessionId: result.sessionId,
        currentScene: createSceneFromNode(LIGHTHOUSE_STATIC_SCRIPT.entry_01),
        currentNodeId: 'entry_01',
        status: 'opening_welcome',
        stepCount: 0,
      }))
    } catch {
      if (controller.signal.aborted || !isMountedRef.current) return
      setState(prev => ({
        ...prev,
        status: 'waiting_final_close',
        closingLines: SAFE_ERROR_LINES,
        currentScene: null,
        currentNodeId: null,
        npcResponseLines: [],
      }))
    } finally {
      startInFlightRef.current = false
    }
  }, [patientProfileId])

  const advance = useCallback(() => {
    setState(prev => {
      if (prev.status === 'opening_welcome') {
        return {
          ...prev,
          status: 'opening_safe_line',
          selectedChoiceIntentId: null,
        }
      }

      if (prev.status === 'opening_safe_line') {
        return {
          ...prev,
          status: 'entry_question',
          currentScene: createSceneFromNode(LIGHTHOUSE_STATIC_SCRIPT.entry_01),
          currentNodeId: 'entry_01',
          selectedChoiceIntentId: null,
        }
      }

      if (prev.status === 'waiting_final_close') {
        queueMicrotask(close)
      }

      return prev
    })
  }, [close])

  const selectChoice = useCallback(
    async (choice: EmotionChoiceViewModel) => {
      const targetSessionId = sessionIdRef.current
      if (
        !targetSessionId ||
        (state.status !== 'entry_question' && state.status !== 'waiting_choice')
      ) {
        return
      }

      const currentNode = getNode(state.currentNodeId)
      const currentQuestionText =
        currentNode?.questionText ?? state.currentScene?.questionText ?? ''
      const nextNode = getNode(choice.nextNodeId)
      const staticResponseLines = getSafeLines(choice.responseLines, [SAFE_EMPTY_LINE])
      const requestSeq = ++requestSeqRef.current
      const controller = new AbortController()
      abortControllerRef.current?.abort()
      abortControllerRef.current = controller

      const rewritePromise = submitLighthouseEmotionTurn(
        targetSessionId,
        createResponseRewriteRequest(choice, currentQuestionText, nextNode),
        controller.signal,
      )
      void rewritePromise.catch(() => undefined)

      setState(prev => ({
        ...prev,
        status: 'showing_response',
        selectedChoiceIntentId: choice.choiceIntentId,
        npcResponseLines: staticResponseLines,
        currentScene: null,
        errorMessage: null,
        stepCount: prev.stepCount + 1,
      }))

      const rewriteResult = await Promise.race([
        rewritePromise.then(response => ({ kind: 'response' as const, response })),
        wait(LLM_REWRITE_WAIT_MS).then(() => ({ kind: 'timeout' as const })),
      ]).catch(() => ({ kind: 'timeout' as const }))

      if (!isMountedRef.current || requestSeq !== requestSeqRef.current) return

      if (rewriteResult.kind === 'response') {
        const rewriteLines = getValidatedRewriteLines(rewriteResult.response, staticResponseLines)
        setState(prev => ({
          ...prev,
          npcResponseLines: rewriteLines,
        }))
      }

      await wait(RESPONSE_DELAY_MS)

      if (!isMountedRef.current || requestSeq !== requestSeqRef.current) return

      if (choice.endAfterSelect || !nextNode) {
        await finish('COMPLETED', targetSessionId)
        return
      }

      setState(prev => ({
        ...prev,
        status: 'waiting_choice',
        currentScene: createSceneFromNode(nextNode),
        currentNodeId: nextNode.nodeId,
        npcResponseLines: [],
        selectedChoiceIntentId: null,
      }))
    },
    [finish, state.currentNodeId, state.currentScene?.questionText, state.status],
  )

  const cancel = useCallback(() => {
    close()
  }, [close])

  const reset = useCallback(() => {
    abortActiveRequest()
    sessionIdRef.current = null
    startInFlightRef.current = false
    setState(initialState)
  }, [abortActiveRequest])

  return {
    state,
    start,
    advance,
    selectChoice,
    finish,
    cancel,
    close,
    reset,
  }
}
