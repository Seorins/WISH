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

const RESPONSE_DELAY_MS = 900
const EMPTY_RESPONSE_DELAY_MS = 200
const FINISHED_CLOSE_DELAY_MS = 1500

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

export function useLighthouseEmotionSession({
  patientProfileId,
  onFinished,
}: {
  patientProfileId: number
  onFinished?: () => void
}) {
  const timerRef = useRef<number | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const startInFlightRef = useRef(false)
  const [state, setState] = useState<LighthouseEmotionState>(initialState)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      clearTimer()
    }
  }, [clearTimer])

  const finish = useCallback(
    async (
      finishReason: FinishLighthouseEmotionRequest['finishReason'] = 'COMPLETED',
      sessionIdOverride?: string,
    ) => {
      const targetSessionId = sessionIdOverride ?? sessionIdRef.current
      if (!targetSessionId) {
        onFinished?.()
        return
      }

      clearTimer()
      setState(prev => ({
        ...prev,
        status: 'closing',
      }))

      try {
        const result = await finishLighthouseEmotionSession(targetSessionId, finishReason)
        const closingLines = getSafeLines(result.closingLines, ['오늘 말해줘서 고맙구나.'])

        setState(prev => ({
          ...prev,
          status: 'finished',
          closingLines,
          currentScene: null,
          npcResponseLines: [],
          selectedChoiceIntentId: null,
        }))

        timerRef.current = window.setTimeout(() => {
          sessionIdRef.current = null
          onFinished?.()
        }, FINISHED_CLOSE_DELAY_MS)
      } catch {
        setState(prev => ({
          ...prev,
          status: 'error',
          errorMessage: '잠시 후 다시 말을 걸어줘.',
        }))
      }
    },
    [clearTimer, onFinished],
  )

  const start = useCallback(async () => {
    if (startInFlightRef.current || sessionIdRef.current) return

    if (!Number.isInteger(patientProfileId) || patientProfileId <= 0) {
      setState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: '잠시 후 다시 말을 걸어줘.',
      }))
      return
    }

    clearTimer()
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
      const safeScene = sanitizeEmotionScene(result.scene, true)
      sessionIdRef.current = result.sessionId

      setState(prev => ({
        ...prev,
        sessionId: result.sessionId,
        status: 'waiting_choice',
        currentScene: safeScene,
        stepCount: 0,
      }))
    } catch {
      setState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: '잠시 후 다시 말을 걸어줘.',
      }))
    } finally {
      startInFlightRef.current = false
    }
  }, [clearTimer, patientProfileId])

  const selectChoice = useCallback(
    async (choice: EmotionChoiceViewModel) => {
      const targetSessionId = sessionIdRef.current
      if (!targetSessionId || state.status !== 'waiting_choice') return

      clearTimer()
      setState(prev => ({
        ...prev,
        status: 'submitting_choice',
        selectedChoiceIntentId: choice.choiceIntentId,
        errorMessage: null,
      }))

      try {
        const currentQuestionText = state.currentScene?.questionText ?? ''
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
        const npcResponseLines = getSafeLines(result.npcResponse, [])

        setState(prev => ({
          ...prev,
          status: 'showing_response',
          npcResponseLines,
          stepCount: prev.stepCount + 1,
        }))

        const delayMs = npcResponseLines.length > 0 ? RESPONSE_DELAY_MS : EMPTY_RESPONSE_DELAY_MS
        timerRef.current = window.setTimeout(() => {
          if (result.nextScene?.shouldEndSession) {
            void finish(
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
        }, delayMs)
      } catch {
        setState(prev => ({
          ...prev,
          status: 'error',
          errorMessage: '잠시 후 다시 말을 걸어줘.',
        }))
      }
    },
    [clearTimer, finish, state.currentScene?.questionText, state.status],
  )

  const cancel = useCallback(() => {
    if (sessionIdRef.current) {
      void finish('CANCELLED')
      return
    }

    clearTimer()
    setState(initialState)
    onFinished?.()
  }, [clearTimer, finish, onFinished])

  const reset = useCallback(() => {
    clearTimer()
    sessionIdRef.current = null
    startInFlightRef.current = false
    setState(initialState)
  }, [clearTimer])

  return {
    state,
    start,
    selectChoice,
    finish,
    cancel,
    reset,
  }
}
