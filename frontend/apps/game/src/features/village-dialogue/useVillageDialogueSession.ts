import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { saveVillagerChoiceEvent } from './villageDialogueClient'
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

function createLocalSessionId(npcId: VillagerNpcId) {
  const randomId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `villager-${npcId}-${randomId}`
}

function findScene(script: VillagerDialogueScript, sceneId: string | null): VillagerScene | null {
  if (!sceneId) return null
  return script.scenes.find(scene => scene.sceneId === sceneId) ?? null
}

export function useVillageDialogueSession(onFinished?: () => void) {
  const [status, setStatus] = useState<VillagerDialogueStatus>('idle')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [currentNpcId, setCurrentNpcId] = useState<VillagerNpcId | null>(null)
  const [currentScene, setCurrentScene] = useState<VillagerScene | null>(null)
  const [currentResponse, setCurrentResponse] = useState<string | null>(null)
  const [selectedEvents, setSelectedEvents] = useState<VillagerChoiceEvent[]>([])
  const timeoutIds = useRef<number[]>([])

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
    setStatus('idle')
    setSessionId(null)
    setCurrentNpcId(null)
    setCurrentScene(null)
    setCurrentResponse(null)
    setSelectedEvents([])
  }, [clearTimers])

  const closeDialogue = useCallback(() => {
    resetSession()
    onFinished?.()
  }, [onFinished, resetSession])

  const startVillagerDialogue = useCallback(
    (npcId: VillagerNpcId) => {
      const nextScript = villageDialogues[npcId]
      clearTimers()
      setSessionId(createLocalSessionId(npcId))
      setCurrentNpcId(npcId)
      setCurrentScene(nextScript.scenes[0])
      setCurrentResponse(buildOpeningLine(nextScript))
      setSelectedEvents([])
      setStatus('opening')
      queueTimer(() => {
        setCurrentResponse(null)
        setStatus('opening')
        queueTimer(() => {
          setStatus('waiting_choice')
        }, QUESTION_READING_DELAY_MS)
      }, OPENING_DELAY_MS)
    },
    [clearTimers, queueTimer],
  )

  const selectChoice = useCallback(
    async (choice: VillagerChoice) => {
      if (status !== 'waiting_choice' || !sessionId || !script || !currentScene) return

      setStatus('submitting_choice')
      const event: VillagerChoiceEvent = {
        sessionId,
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
            closeDialogue()
          }, CLOSING_DELAY_MS)
        }, RESPONSE_DELAY_MS)
      } catch {
        setStatus('error')
        setCurrentResponse('저장에 실패했어요. 잠시 후 다시 시도해줘.')
      }
    },
    [closeDialogue, currentScene, queueTimer, script, sessionId, status],
  )

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
    closeDialogue,
  }
}
