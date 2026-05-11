import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cancelVillagerDialogueSession, saveVillagerChoiceEvent } from './villageDialogueClient'
import { pickRandomCounselingScript, SHARED_COUNSELING_SCRIPTS } from './sharedCounselingScripts'
import { VILLAGER_FIRST_GREETING, villageDialogues } from './villageDialogues'
import type {
  CounselingScript,
  VillagerChoice,
  VillagerChoiceEvent,
  VillagerDialogueNode,
  VillagerDialogueStatus,
  VillagerNpcId,
} from './types'

const OPENING_STEP_DELAY_MS = 1500
const RESPONSE_LINE_DELAY_MS = 1800
const MIN_RESPONSE_DELAY_MS = 1800
const SAVE_ERROR_LINE = '잠시 후 다시 말을 걸어줘.'

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

export function useVillageDialogueSession(onFinished?: () => void) {
  const [status, setStatus] = useState<VillagerDialogueStatus>('idle')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [currentNpcId, setCurrentNpcId] = useState<VillagerNpcId | null>(null)
  const [currentScript, setCurrentScript] = useState<CounselingScript | null>(null)
  const [currentNode, setCurrentNode] = useState<VillagerDialogueNode | null>(null)
  const [visibleLines, setVisibleLines] = useState<string[]>([])
  const [selectedChoiceIntentId, setSelectedChoiceIntentId] = useState<string | null>(null)
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

  const showQuestion = useCallback((node: VillagerDialogueNode) => {
    setCurrentNode(node)
    setVisibleLines([node.questionText])
    setSelectedChoiceIntentId(null)
    setStatus('waiting_choice')
  }, [])

  const scheduleOpening = useCallback(
    (sharedScript: CounselingScript, startNode: VillagerDialogueNode) => {
      queueTimer(() => {
        if (sharedScript.contextLine) {
          setVisibleLines([sharedScript.contextLine])
          setStatus('opening_context')
          queueTimer(() => showQuestion(startNode), OPENING_STEP_DELAY_MS)
          return
        }

        showQuestion(startNode)
      }, OPENING_STEP_DELAY_MS)
    },
    [queueTimer, showQuestion],
  )

  const resetSession = useCallback(() => {
    clearTimers()
    setStatus('idle')
    setSessionId(null)
    setCurrentNpcId(null)
    setCurrentScript(null)
    setCurrentNode(null)
    setVisibleLines([])
    setSelectedChoiceIntentId(null)
    setSelectedEvents([])
  }, [clearTimers])

  const closeDialogue = useCallback(() => {
    resetSession()
    onFinished?.()
  }, [onFinished, resetSession])

  const cancelDialogue = useCallback(() => {
    if (sessionId) {
      void cancelVillagerDialogueSession(sessionId).catch(() => undefined)
    }
    closeDialogue()
  }, [closeDialogue, sessionId])

  const startVillagerDialogue = useCallback(
    (npcId: VillagerNpcId) => {
      const sharedScript = pickRandomCounselingScript(SHARED_COUNSELING_SCRIPTS)
      const startNode = getStartNode(sharedScript)

      clearTimers()
      setSessionId(createLocalSessionId(npcId))
      setCurrentNpcId(npcId)
      setCurrentScript(sharedScript)
      setCurrentNode(startNode)
      setSelectedChoiceIntentId(null)
      setSelectedEvents([])
      setStatus('opening_greeting')
      setVisibleLines([VILLAGER_FIRST_GREETING[npcId]])
      scheduleOpening(sharedScript, startNode)
    },
    [clearTimers, scheduleOpening],
  )

  const advanceDialogue = useCallback(() => {
    if (status === 'opening_greeting' && currentScript && currentNode) {
      clearTimers()
      if (currentScript.contextLine) {
        setVisibleLines([currentScript.contextLine])
        setStatus('opening_context')
        queueTimer(() => showQuestion(currentNode), OPENING_STEP_DELAY_MS)
        return
      }

      showQuestion(currentNode)
      return
    }

    if (status === 'opening_context' && currentNode) {
      clearTimers()
      showQuestion(currentNode)
      return
    }

    if (status === 'ending_wait') {
      closeDialogue()
    }
  }, [clearTimers, closeDialogue, currentNode, currentScript, queueTimer, showQuestion, status])

  const selectChoice = useCallback(
    async (choice: VillagerChoice) => {
      if (status !== 'waiting_choice' || !sessionId || !script || !currentScript || !currentNode) {
        return
      }

      clearTimers()
      setStatus('submitting_choice')
      setSelectedChoiceIntentId(choice.choiceIntentId)

      const event: VillagerChoiceEvent = {
        sessionId,
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
        await saveVillagerChoiceEvent(event)
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
            const endingLines =
              choice.endingLines && choice.endingLines.length > 0
                ? choice.endingLines
                : [currentScript.fallbackEndingLine ?? '필요하면 다시 와.']

            setVisibleLines(endingLines.slice(0, 2))
            setSelectedChoiceIntentId(null)
            setStatus('ending_wait')
            return
          }

          const nextNode = currentScript.nodes[choice.nextNodeId]
          if (!nextNode) {
            closeDialogue()
            return
          }

          showQuestion(nextNode)
        }, delayMs)
      } catch {
        setStatus('error')
        setVisibleLines([SAVE_ERROR_LINE])
      }
    },
    [
      clearTimers,
      closeDialogue,
      currentNode,
      currentScript,
      queueTimer,
      script,
      sessionId,
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
