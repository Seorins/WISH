import { useCallback, useEffect, useRef, useState } from 'react'
import {
  finishLighthouseEmotionSession,
  sanitizeEmotionScene,
  startLighthouseEmotionSession,
  submitLighthouseEmotionTurn,
} from './lighthouseEmotionClient'
import type {
  EmotionChoiceViewModel,
  FinishLighthouseEmotionRequest,
  LighthouseEmotionState,
} from './types'

const OPENING_DELAY_MS = 3000
const RESPONSE_DELAY_MS = 1700
const EMPTY_RESPONSE_DELAY_MS = 200
const CLOSING_DELAY_MS = 3200

const SAFE_ERROR_MESSAGE = '잠시 후 다시 말을 걸어줘.'
const LIGHTHOUSE_OPENING_LINES = [
  '안녕, 또 와줬구나.',
  '오늘 등대 불은 잔잔하게 켜져 있어.',
  '괜찮다면 지금 마음을 조금 나눠볼래?',
]
const SAFE_CLOSING_LINES = [
  '오늘 이야기해줘서 고맙구나.',
  '여기서 잠깐 쉬어가도 괜찮단다.',
  '등대 불은 계속 켜둘게.',
  '필요하면 언제든 다시 와.',
]
const SAFE_REST_CLOSING_LINES = [
  '알겠다. 오늘은 쉬어도 괜찮단다.',
  '말하지 않는 날도 괜찮아.',
  '등대 불은 조용히 켜둘게.',
  '편할 때 다시 와.',
]

const initialState: LighthouseEmotionState = {
  sessionId: null,
  status: 'idle',
  currentScene: null,
  npcResponseLines: [],
  closingLines: [],
  selectedChoiceIntentId: null,
  stepCount: 0,
  errorMessage: null,
}

function getSafeLines(lines: unknown, fallback: string[]) {
  if (!Array.isArray(lines)) return fallback
  const safeLines = lines.filter(line => typeof line === 'string' && line.trim().length > 0)
  return safeLines.length > 0 ? safeLines : fallback
}

function wait(delayMs: number) {
  return new Promise(resolve => {
    window.setTimeout(resolve, delayMs)
  })
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
  const [state, setState] = useState<LighthouseEmotionState>(initialState)

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const close = useCallback(() => {
    sessionIdRef.current = null
    startInFlightRef.current = false
    setState(initialState)
    onFinished?.()
  }, [onFinished])

  const finish = useCallback(
    async (
      finishReason: FinishLighthouseEmotionRequest['finishReason'] = 'COMPLETED',
      sessionIdOverride?: string,
    ) => {
      const targetSessionId = sessionIdOverride ?? sessionIdRef.current
      if (!targetSessionId) {
        close()
        return
      }

      setState(prev => ({
        ...prev,
        status: 'finishing',
        currentScene: null,
        npcResponseLines: [],
        selectedChoiceIntentId: null,
        errorMessage: null,
      }))

      try {
        const result = await finishLighthouseEmotionSession(targetSessionId, finishReason)
        if (!isMountedRef.current) return

        const closingLines = getSafeLines(
          result.closingLines,
          finishReason === 'REST' ? SAFE_REST_CLOSING_LINES : SAFE_CLOSING_LINES,
        )
        setState(prev => ({
          ...prev,
          status: 'showing_closing',
          closingLines,
          currentScene: null,
          npcResponseLines: [],
          selectedChoiceIntentId: null,
        }))
        await wait(CLOSING_DELAY_MS)
        if (!isMountedRef.current || sessionIdRef.current !== targetSessionId) return
        close()
      } catch {
        if (!isMountedRef.current) return
        setState(prev => ({
          ...prev,
          status: 'showing_closing',
          closingLines: finishReason === 'REST' ? SAFE_REST_CLOSING_LINES : SAFE_CLOSING_LINES,
          currentScene: null,
          npcResponseLines: [],
          selectedChoiceIntentId: null,
        }))
        await wait(CLOSING_DELAY_MS)
        if (!isMountedRef.current || sessionIdRef.current !== targetSessionId) return
        close()
      }
    },
    [close],
  )

  const start = useCallback(async () => {
    if (startInFlightRef.current || sessionIdRef.current) return

    if (!Number.isInteger(patientProfileId) || patientProfileId <= 0) {
      setState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: SAFE_ERROR_MESSAGE,
      }))
      return
    }

    setState(prev => ({
      ...prev,
      status: 'starting',
      errorMessage: null,
      selectedChoiceIntentId: null,
      npcResponseLines: [],
      closingLines: [],
    }))

    try {
      startInFlightRef.current = true
      const result = await startLighthouseEmotionSession(patientProfileId)
      if (!isMountedRef.current) return

      const safeScene = sanitizeEmotionScene(result.scene, true)
      sessionIdRef.current = result.sessionId

      setState(prev => ({
        ...prev,
        sessionId: result.sessionId,
        status: 'showing_response',
        currentScene: safeScene,
        npcResponseLines: LIGHTHOUSE_OPENING_LINES,
        stepCount: 0,
      }))

      await wait(OPENING_DELAY_MS)
      if (!isMountedRef.current || sessionIdRef.current !== result.sessionId) return

      setState(prev => ({
        ...prev,
        status: 'waiting_choice',
        npcResponseLines: [],
      }))
    } catch {
      if (!isMountedRef.current) return
      setState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: SAFE_ERROR_MESSAGE,
      }))
    } finally {
      startInFlightRef.current = false
    }
  }, [patientProfileId])

  const selectChoice = useCallback(
    async (choice: EmotionChoiceViewModel) => {
      const targetSessionId = sessionIdRef.current
      if (!targetSessionId || state.status !== 'waiting_choice') return

      const currentQuestionText = state.currentScene?.questionText ?? ''

      setState(prev => ({
        ...prev,
        status: 'loading_next',
        selectedChoiceIntentId: choice.choiceIntentId,
        errorMessage: null,
      }))

      try {
        const result = await submitLighthouseEmotionTurn(targetSessionId, {
          questionText: currentQuestionText,
          selectedChoice: {
            choiceIntentId: choice.choiceIntentId,
            text: choice.text,
            ...(typeof choice.intensity === 'number' ? { intensity: choice.intensity } : {}),
            ...(Array.isArray(choice.concernFlags) ? { concernFlags: choice.concernFlags } : {}),
            ...(Array.isArray(choice.protectiveFactors)
              ? { protectiveFactors: choice.protectiveFactors }
              : {}),
          },
        })
        if (!isMountedRef.current) return

        const npcResponseLines = getSafeLines(result.npcResponse, [])

        if (npcResponseLines.length > 0) {
          setState(prev => ({
            ...prev,
            status: 'showing_response',
            npcResponseLines,
            stepCount: prev.stepCount + 1,
          }))
          await wait(RESPONSE_DELAY_MS)
        } else {
          setState(prev => ({
            ...prev,
            status: 'showing_response',
            npcResponseLines: [],
            stepCount: prev.stepCount + 1,
          }))
          await wait(EMPTY_RESPONSE_DELAY_MS)
        }

        if (!isMountedRef.current) return

        if (result.nextScene?.shouldEndSession) {
          await finish(
            choice.choiceIntentId === 'rest_today' ? 'REST' : 'COMPLETED',
            targetSessionId,
          )
          return
        }

        const safeNextScene = sanitizeEmotionScene(result.nextScene, false)
        setState(prev => ({
          ...prev,
          status: 'waiting_choice',
          currentScene: safeNextScene,
          npcResponseLines: [],
          selectedChoiceIntentId: null,
        }))
      } catch {
        if (!isMountedRef.current) return
        setState(prev => ({
          ...prev,
          status: 'error',
          errorMessage: SAFE_ERROR_MESSAGE,
          currentScene: null,
          npcResponseLines: [],
          selectedChoiceIntentId: null,
        }))
      }
    },
    [finish, state.currentScene?.questionText, state.status],
  )

  const cancel = useCallback(() => {
    if (sessionIdRef.current) {
      void finish('CANCELLED')
      return
    }

    close()
  }, [close, finish])

  const reset = useCallback(() => {
    sessionIdRef.current = null
    startInFlightRef.current = false
    setState(initialState)
  }, [])

  return {
    state,
    start,
    selectChoice,
    finish,
    cancel,
    close,
    reset,
  }
}
