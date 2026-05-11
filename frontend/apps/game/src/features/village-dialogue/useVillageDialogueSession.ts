import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  finishVillageDialogueSession,
  saveVillagerChoiceEvent,
  startVillageDialogueSession,
  type VillageDialogueFinishReason,
} from './villageDialogueClient'
import { VILLAGE_NPC_TO_API_ENUM } from './npcMapping'
import { villageDialogues } from './villageDialogues'
import type {
  VillagerChoice,
  VillagerChoiceEvent,
  VillagerDialogueScript,
  VillagerDialogueStatus,
  VillagerNpcId,
  VillagerScene,
} from './types'

const OPENING_DELAY_MS = 2200
const QUESTION_READING_DELAY_MS = 1400
const RESPONSE_DELAY_MS = 1800
const CLOSING_DELAY_MS = 2200

function buildOpeningLine(script: VillagerDialogueScript) {
  return `안녕! ${script.greetingLine}`
}

function findScene(script: VillagerDialogueScript, sceneId: string | null): VillagerScene | null {
  if (!sceneId) return null
  return script.scenes.find(scene => scene.sceneId === sceneId) ?? null
}

export function useVillageDialogueSession(
  patientProfileId: number | undefined,
  onFinished?: () => void,
) {
  const [status, setStatus] = useState<VillagerDialogueStatus>('idle')
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [currentNpcId, setCurrentNpcId] = useState<VillagerNpcId | null>(null)
  const [currentScene, setCurrentScene] = useState<VillagerScene | null>(null)
  const [currentResponse, setCurrentResponse] = useState<string | null>(null)
  const [selectedEvents, setSelectedEvents] = useState<VillagerChoiceEvent[]>([])
  const timeoutIds = useRef<number[]>([])
  const sessionIdRef = useRef<number | null>(null)
  const startInFlightRef = useRef(false)

  const script = useMemo(
    () => (currentNpcId ? villageDialogues[currentNpcId] : null),
    [currentNpcId],
  )

  const clearTimers = useCallback(() => {
    timeoutIds.current.forEach(timeoutId => window.clearTimeout(timeoutId))
    timeoutIds.current = []
  }, [])

  const queueTimer = useCallback((callback: () => void, delayMs: number) => {
    const timeoutId = window.setTimeout(callback, delayMs)
    timeoutIds.current.push(timeoutId)
  }, [])

  const resetSession = useCallback(() => {
    clearTimers()
    sessionIdRef.current = null
    setStatus('idle')
    setSessionId(null)
    setCurrentNpcId(null)
    setCurrentScene(null)
    setCurrentResponse(null)
    setSelectedEvents([])
  }, [clearTimers])

  const finishSession = useCallback(async (reason: VillageDialogueFinishReason) => {
    const target = sessionIdRef.current
    if (!target) return
    try {
      await finishVillageDialogueSession(target, reason)
    } catch {
      // 마감 실패는 UX 흐름을 막지 않음. 백엔드 상태는 stale 될 수 있지만 다음 세션 시작에는 영향 없음.
    }
  }, [])

  const closeDialogue = useCallback(
    (reason: VillageDialogueFinishReason = 'COMPLETED') => {
      void finishSession(reason)
      resetSession()
      onFinished?.()
    },
    [finishSession, onFinished, resetSession],
  )

  const startVillagerDialogue = useCallback(
    async (npcId: VillagerNpcId) => {
      if (startInFlightRef.current || sessionIdRef.current) return
      if (!Number.isInteger(patientProfileId) || (patientProfileId ?? 0) <= 0) {
        setStatus('error')
        setCurrentResponse('잠시 후 다시 말을 걸어줘.')
        return
      }

      const nextScript = villageDialogues[npcId]
      const npcEnum = VILLAGE_NPC_TO_API_ENUM[npcId]
      clearTimers()
      setCurrentNpcId(npcId)
      setCurrentScene(nextScript.scenes[0])
      setCurrentResponse(buildOpeningLine(nextScript))
      setSelectedEvents([])
      setStatus('opening')

      try {
        startInFlightRef.current = true
        const result = await startVillageDialogueSession(patientProfileId as number, npcEnum)
        sessionIdRef.current = result.sessionId
        setSessionId(result.sessionId)

        queueTimer(() => {
          setCurrentResponse(null)
          setStatus('opening')
          queueTimer(() => {
            setStatus('waiting_choice')
          }, QUESTION_READING_DELAY_MS)
        }, OPENING_DELAY_MS)
      } catch {
        setStatus('error')
        setCurrentResponse('잠시 후 다시 말을 걸어줘.')
      } finally {
        startInFlightRef.current = false
      }
    },
    [clearTimers, patientProfileId, queueTimer],
  )

  const selectChoice = useCallback(
    async (choice: VillagerChoice) => {
      const targetSessionId = sessionIdRef.current
      if (status !== 'waiting_choice' || !targetSessionId || !script || !currentScene) return

      setStatus('submitting_choice')
      const event: VillagerChoiceEvent = {
        sessionId: targetSessionId,
        npcId: script.npcId,
        sceneId: currentScene.sceneId,
        questionText: currentScene.questionText,
        choiceIntentId: choice.choiceIntentId,
        choiceText: choice.text,
        intensity: choice.intensity,
        concernFlags: choice.concernFlags,
        protectiveFactors: choice.protectiveFactors,
        generatedBy: 'STATIC',
        createdAt: new Date().toISOString(),
      }

      try {
        await saveVillagerChoiceEvent(event)
        setSelectedEvents(prev => [...prev, event])
        setCurrentResponse(choice.npcResponse)
        setStatus('showing_response')

        queueTimer(() => {
          const nextScene = findScene(script, choice.nextSceneId)
          if (nextScene) {
            setCurrentScene(nextScene)
            setCurrentResponse(null)
            setStatus('showing_response')
            queueTimer(() => {
              setStatus('waiting_choice')
            }, QUESTION_READING_DELAY_MS)
            return
          }

          setCurrentResponse(script.closingLine)
          setStatus('closing')
          queueTimer(() => {
            setStatus('finished')
            closeDialogue('COMPLETED')
          }, CLOSING_DELAY_MS)
        }, RESPONSE_DELAY_MS)
      } catch {
        setStatus('error')
        setCurrentResponse('저장에 실패했어요. 잠시 후 다시 시도해줘.')
      }
    },
    [closeDialogue, currentScene, queueTimer, script, status],
  )

  const cancelDialogue = useCallback(() => {
    closeDialogue('CANCELLED')
  }, [closeDialogue])

  useEffect(() => clearTimers, [clearTimers])

  return {
    status,
    sessionId,
    currentNpcId,
    currentScene,
    currentResponse,
    selectedEvents,
    script,
    startVillagerDialogue,
    selectChoice,
    closeDialogue: cancelDialogue,
  }
}
