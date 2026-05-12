import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  cancelVillagerDialogueSession,
  finishVillageDialogueSession,
  saveVillagerChoiceEvent,
  startVillageDialogueSession,
  type VillageDialogueFinishReason,
} from './villageDialogueClient'
import {
  buildActivityAwareEndingLines,
  getChoiceEndingType,
  getTodayActivityState,
} from './activityAwareEnding'
import { VILLAGE_NPC_TO_API_ENUM } from './npcMapping'
import { pickRandomCounselingScript, SHARED_COUNSELING_SCRIPTS } from './sharedCounselingScripts'
import { VILLAGER_FIRST_GREETING, villageDialogues } from './villageDialogues'
import type {
  CounselingScript,
  DailyActivityState,
  VillagerChoice,
  VillagerChoiceEvent,
  VillagerDialogueNode,
  VillagerDialogueStatus,
  VillagerNpcId,
} from './types'

const RESPONSE_LINE_DELAY_MS = 850
const MIN_RESPONSE_DELAY_MS = 900
const SAVE_ERROR_LINE = '잠시 후 다시 말을 걸어줘.'

function logVillageDialogueDebug(message: string, payload?: unknown) {
  if (!import.meta.env.DEV) return
  if (payload === undefined) {
    console.info(`[villager-dialogue] ${message}`)
    return
  }
  console.info(`[villager-dialogue] ${message}`, payload)
}

function createLocalSessionId(npcId: VillagerNpcId) {
  const randomId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `villager-${npcId}-${randomId}`
}

function createClientEventId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getStartNode(script: CounselingScript) {
  const node = script.nodes[script.startNodeId]
  if (!node) throw new Error(`No start node for ${script.scriptId}`)
  return node
}

export function useVillageDialogueSession(
  patientProfileId: number | undefined,
  onFinished?: () => void,
  dailyActivityState?: DailyActivityState,
) {
  const [status, setStatus] = useState<VillagerDialogueStatus>('idle')
  const [sessionId, setSessionId] = useState<string | number | null>(null)
  const [currentNpcId, setCurrentNpcId] = useState<VillagerNpcId | null>(null)
  const [currentScript, setCurrentScript] = useState<CounselingScript | null>(null)
  const [currentNode, setCurrentNode] = useState<VillagerDialogueNode | null>(null)
  const [visibleLines, setVisibleLines] = useState<string[]>([])
  const [selectedChoiceIntentId, setSelectedChoiceIntentId] = useState<string | null>(null)
  const [selectedEvents, setSelectedEvents] = useState<VillagerChoiceEvent[]>([])
  const timeoutIds = useRef<number[]>([])
  const sessionIdRef = useRef<string | number | null>(null)
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

  const showQuestion = useCallback((node: VillagerDialogueNode) => {
    setCurrentNode(node)
    setVisibleLines([node.questionText])
    setSelectedChoiceIntentId(null)
    setStatus('waiting_choice')
  }, [])

  const resetSession = useCallback(() => {
    clearTimers()
    sessionIdRef.current = null
    setStatus('idle')
    setSessionId(null)
    setCurrentNpcId(null)
    setCurrentScript(null)
    setCurrentNode(null)
    setVisibleLines([])
    setSelectedChoiceIntentId(null)
    setSelectedEvents([])
  }, [clearTimers])

  const finishSession = useCallback(async (reason: VillageDialogueFinishReason) => {
    const target = sessionIdRef.current
    if (typeof target !== 'number') return
    try {
      await finishVillageDialogueSession(target, reason)
    } catch {
      // Finish failures should not trap the child in the dialogue UI.
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

  const cancelDialogue = useCallback(() => {
    const target = sessionIdRef.current
    if (target) {
      void cancelVillagerDialogueSession(target).catch(() => undefined)
    }
    closeDialogue('CANCELLED')
  }, [closeDialogue])

  const startVillagerDialogue = useCallback(
    async (npcId: VillagerNpcId) => {
      if (startInFlightRef.current || sessionIdRef.current) return

      const sharedScript = pickRandomCounselingScript(SHARED_COUNSELING_SCRIPTS)
      const startNode = getStartNode(sharedScript)
      const nextSessionId =
        Number.isInteger(patientProfileId) && (patientProfileId ?? 0) > 0
          ? null
          : createLocalSessionId(npcId)

      clearTimers()
      setSessionId(nextSessionId)
      sessionIdRef.current = nextSessionId
      setCurrentNpcId(npcId)
      setCurrentScript(sharedScript)
      setCurrentNode(startNode)
      setSelectedChoiceIntentId(null)
      setSelectedEvents([])
      setStatus('opening_greeting')
      setVisibleLines(VILLAGER_FIRST_GREETING[npcId].slice(0, 2))

      try {
        startInFlightRef.current = true
        if (Number.isInteger(patientProfileId) && (patientProfileId ?? 0) > 0) {
          const result = await startVillageDialogueSession(
            patientProfileId as number,
            VILLAGE_NPC_TO_API_ENUM[npcId],
          )
          sessionIdRef.current = result.sessionId
          setSessionId(result.sessionId)
          logVillageDialogueDebug('backend session ready', {
            npcId,
            sessionId: result.sessionId,
            status: result.status,
          })
        }
      } catch {
        logVillageDialogueDebug('failed to start backend session', { npcId, patientProfileId })
        setStatus('error')
        setVisibleLines([SAVE_ERROR_LINE])
      } finally {
        startInFlightRef.current = false
      }
    },
    [clearTimers, patientProfileId],
  )

  const advanceDialogue = useCallback(() => {
    if (status === 'opening_greeting' && currentScript && currentNode) {
      if (startInFlightRef.current || !sessionIdRef.current) {
        logVillageDialogueDebug('opening advance blocked until session is ready', {
          startInFlight: startInFlightRef.current,
          sessionId: sessionIdRef.current,
        })
        return
      }
      clearTimers()
      showQuestion(currentNode)
      return
    }

    if (status === 'waiting_final_close') {
      closeDialogue('COMPLETED')
    }
  }, [clearTimers, closeDialogue, currentNode, currentScript, showQuestion, status])

  const selectChoice = useCallback(
    async (choice: VillagerChoice) => {
      const targetSessionId = sessionIdRef.current
      if (
        status !== 'waiting_choice' ||
        !targetSessionId ||
        !script ||
        !currentScript ||
        !currentNode
      ) {
        logVillageDialogueDebug('choice ignored before save', {
          choiceIntentId: choice.choiceIntentId,
          status,
          sessionId: targetSessionId,
          hasScript: Boolean(script),
          hasCurrentScript: Boolean(currentScript),
          hasCurrentNode: Boolean(currentNode),
        })
        return
      }

      clearTimers()
      setStatus('submitting_choice')
      setSelectedChoiceIntentId(choice.choiceIntentId)

      const event: VillagerChoiceEvent = {
        sessionId: targetSessionId,
        clientEventId: createClientEventId(),
        npcId: script.npcId,
        displayName: script.displayName,
        npcName: script.backendNpcName,
        topicId: currentScript.scriptId,
        sceneId: currentNode.nodeId,
        nodeId: currentNode.nodeId,
        questionText: currentNode.questionText,
        choiceIntentId: choice.choiceIntentId,
        choiceText: choice.text,
        intensity: choice.intensity,
        concernFlags: choice.concernFlags,
        protectiveFactors: choice.protectiveFactors,
        generatedBy: 'STATIC',
        createdAt: new Date().toISOString(),
      }

      try {
        logVillageDialogueDebug('saving choice turn', {
          sessionId: targetSessionId,
          nodeId: currentNode.nodeId,
          choiceIntentId: choice.choiceIntentId,
        })
        await saveVillagerChoiceEvent(event)
        logVillageDialogueDebug('choice turn saved', {
          sessionId: targetSessionId,
          choiceIntentId: choice.choiceIntentId,
        })
        setSelectedEvents(prev => [...prev, event])

        const responseLines =
          choice.responseLines.length > 0 ? choice.responseLines : ['말해줘서 고마워.']
        setVisibleLines([responseLines[0]])
        setStatus('showing_response')

        responseLines.slice(1).forEach((line, index) => {
          queueTimer(
            () => {
              setVisibleLines(prev => [...prev, line].slice(-2))
            },
            (index + 1) * RESPONSE_LINE_DELAY_MS,
          )
        })

        const delayMs = Math.max(
          MIN_RESPONSE_DELAY_MS,
          responseLines.length * RESPONSE_LINE_DELAY_MS,
        )
        queueTimer(() => {
          if (!choice.nextNodeId || choice.endAfterSelect) {
            const resolvedDailyActivityState = getTodayActivityState(dailyActivityState)
            const endingLines = choice.activityEndingLines
              ? resolvedDailyActivityState.hasDoneAnyActivityToday
                ? choice.activityEndingLines.completed
                : choice.activityEndingLines.pending
              : choice.endingLines && choice.endingLines.length > 0
                ? choice.endingLines
                : buildActivityAwareEndingLines({
                    endingType: getChoiceEndingType(choice),
                    dailyActivityState: resolvedDailyActivityState,
                  })

            setVisibleLines(endingLines)
            setSelectedChoiceIntentId(null)
            setStatus('waiting_final_close')
            return
          }

          const nextNode = currentScript.nodes[choice.nextNodeId]
          if (!nextNode) {
            closeDialogue('ERROR')
            return
          }

          showQuestion(nextNode)
        }, delayMs)
      } catch {
        logVillageDialogueDebug('failed to save choice turn', {
          sessionId: targetSessionId,
          choiceIntentId: choice.choiceIntentId,
        })
        setStatus('error')
        setVisibleLines([SAVE_ERROR_LINE])
      }
    },
    [
      clearTimers,
      closeDialogue,
      currentNode,
      currentScript,
      dailyActivityState,
      queueTimer,
      script,
      showQuestion,
      status,
    ],
  )

  useEffect(() => clearTimers, [clearTimers])

  return {
    status,
    sessionId,
    currentNpcId,
    currentTopic: currentScript,
    currentNode,
    visibleLines,
    visibleText: visibleLines.join('\n'),
    selectedChoiceIntentId,
    selectedEvents,
    script,
    startVillagerDialogue,
    selectChoice,
    advanceDialogue,
    closeDialogue,
    cancelDialogue,
  }
}
