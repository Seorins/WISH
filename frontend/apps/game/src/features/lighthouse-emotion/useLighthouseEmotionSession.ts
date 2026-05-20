import { useCallback, useEffect, useRef, useState } from 'react'
import {
  chatWithLighthouseLlm,
  finishLighthouseEmotionSession,
  LIGHTHOUSE_ENTRY_QUESTION,
  MAX_CONVERSATION_HISTORY_TURNS,
  MAX_USER_MESSAGE_LENGTH,
  startLighthouseEmotionSession,
  submitLighthouseChatTurn,
} from './lighthouseEmotionClient'
import type {
  FinishLighthouseEmotionRequest,
  LighthouseChatHistoryItem,
  LighthouseEmotionState,
} from './types'

const RESPONSE_HOLD_MS = 200

export const LIGHTHOUSE_OPENING_WELCOME_LINES = ['안녕, 반가워!']

export const LIGHTHOUSE_OPENING_SAFE_LINES = ['나는 너의 얘기를 들어주는 등대지기야!']
export const LIGHTHOUSE_LOADING_LINE = '...'

const SAFE_ERROR_LINES = ['괜찮아. 잠시 후 다시 이야기해보자.']
const SAFE_EMPTY_LINE = '괜찮아. 천천히 말해도 된단다.'
const SAFE_CLOSING_LINES = ['좋아, 오늘도 너의 얘기를 들려줘서 고마워.', '다음에 또 만나자!']

const initialState: LighthouseEmotionState = {
  sessionId: null,
  status: 'idle',
  currentQuestionText: '',
  npcResponseLines: [],
  closingLines: [],
  conversationHistory: [],
  isFallback: false,
  errorMessage: null,
  stepCount: 0,
}

function wait(delayMs: number) {
  return new Promise<void>(resolve => {
    window.setTimeout(resolve, delayMs)
  })
}

function splitNpcMessageIntoLines(message: string): string[] {
  const parts = message
    .split(/\n+/)
    .map(part => part.trim())
    .filter(part => part.length > 0)
  if (parts.length === 0) return [SAFE_EMPTY_LINE]
  return parts.slice(0, 2)
}

function appendHistory(
  history: LighthouseChatHistoryItem[],
  next: LighthouseChatHistoryItem,
): LighthouseChatHistoryItem[] {
  const merged = [...history, next]
  return merged.slice(-MAX_CONVERSATION_HISTORY_TURNS)
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
  const conversationHistoryRef = useRef<LighthouseChatHistoryItem[]>([])
  const lastNpcQuestionRef = useRef<string>(LIGHTHOUSE_ENTRY_QUESTION)
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
    conversationHistoryRef.current = []
    lastNpcQuestionRef.current = LIGHTHOUSE_ENTRY_QUESTION
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
          npcResponseLines: [],
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
          closingLines: result.closingLines.length > 0 ? result.closingLines : SAFE_CLOSING_LINES,
          npcResponseLines: [],
        }))
      } catch {
        if (controller.signal.aborted || !isMountedRef.current) return
        setState(prev => ({
          ...prev,
          status: 'waiting_final_close',
          closingLines: SAFE_CLOSING_LINES,
          npcResponseLines: [],
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

    conversationHistoryRef.current = []
    lastNpcQuestionRef.current = LIGHTHOUSE_ENTRY_QUESTION

    setState({
      ...initialState,
      status: 'opening_welcome',
      currentQuestionText: LIGHTHOUSE_ENTRY_QUESTION,
    })

    try {
      startInFlightRef.current = true
      const result = await startLighthouseEmotionSession(patientProfileId, controller.signal)
      if (!isMountedRef.current || requestSeq !== requestSeqRef.current) return

      sessionIdRef.current = result.sessionId
      setState(prev => ({
        ...prev,
        sessionId: result.sessionId,
        status: 'opening_welcome',
      }))
    } catch {
      if (controller.signal.aborted || !isMountedRef.current) return
      setState(prev => ({
        ...prev,
        status: 'waiting_final_close',
        closingLines: SAFE_ERROR_LINES,
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
        }
      }

      if (prev.status === 'opening_safe_line') {
        return {
          ...prev,
          status: 'entry_question',
          currentQuestionText: LIGHTHOUSE_ENTRY_QUESTION,
        }
      }

      if (prev.status === 'waiting_final_close') {
        queueMicrotask(close)
      }

      return prev
    })
  }, [close])

  const submitSttInput = useCallback(
    async (transcript: string) => {
      const targetSessionId = sessionIdRef.current
      const trimmed = transcript.trim().slice(0, MAX_USER_MESSAGE_LENGTH)
      if (!targetSessionId || trimmed.length === 0) return

      const previousQuestion = lastNpcQuestionRef.current
      const historyBeforeUser = conversationHistoryRef.current
      const historyAfterUser = appendHistory(historyBeforeUser, {
        role: 'user',
        content: trimmed,
      })
      conversationHistoryRef.current = historyAfterUser

      const requestSeq = ++requestSeqRef.current
      const controller = new AbortController()
      abortControllerRef.current?.abort()
      abortControllerRef.current = controller

      setState(prev => ({
        ...prev,
        status: 'submitting_chat',
        npcResponseLines: [],
        conversationHistory: historyAfterUser,
        errorMessage: null,
      }))

      let npcMessage = ''
      let isFallback = false
      try {
        const result = await chatWithLighthouseLlm(
          patientProfileId,
          trimmed,
          historyBeforeUser,
          controller.signal,
        )
        if (!isMountedRef.current || requestSeq !== requestSeqRef.current) return
        npcMessage = result.npcMessage.trim()
        isFallback = result.isFallback
      } catch {
        if (controller.signal.aborted || !isMountedRef.current) return
        npcMessage = ''
        isFallback = true
      }

      if (npcMessage.length === 0) {
        npcMessage = SAFE_EMPTY_LINE
        isFallback = true
      }

      const responseLines = splitNpcMessageIntoLines(npcMessage)
      const historyAfterAssistant = appendHistory(conversationHistoryRef.current, {
        role: 'assistant',
        content: npcMessage,
      })
      conversationHistoryRef.current = historyAfterAssistant
      lastNpcQuestionRef.current = npcMessage

      try {
        await submitLighthouseChatTurn(
          targetSessionId,
          {
            questionText: previousQuestion,
            userMessage: trimmed,
            npcResponseText: npcMessage,
            isFallback,
          },
          controller.signal,
        )
      } catch {
        // Persisting the turn is best-effort; do not block the dialogue UI.
      }

      if (!isMountedRef.current || requestSeq !== requestSeqRef.current) return

      setState(prev => ({
        ...prev,
        status: 'showing_response',
        npcResponseLines: responseLines,
        conversationHistory: historyAfterAssistant,
        currentQuestionText: npcMessage,
        isFallback,
        stepCount: prev.stepCount + 1,
      }))

      await wait(RESPONSE_HOLD_MS)
    },
    [patientProfileId],
  )

  const cancel = useCallback(() => {
    close()
  }, [close])

  const reset = useCallback(() => {
    abortActiveRequest()
    sessionIdRef.current = null
    startInFlightRef.current = false
    conversationHistoryRef.current = []
    lastNpcQuestionRef.current = LIGHTHOUSE_ENTRY_QUESTION
    setState(initialState)
  }, [abortActiveRequest])

  return {
    state,
    start,
    advance,
    submitSttInput,
    finish,
    cancel,
    close,
    reset,
  }
}
