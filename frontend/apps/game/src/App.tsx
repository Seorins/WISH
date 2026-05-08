import { useCallback, useEffect, useRef, useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { createGame } from './phaser'
import type Phaser from 'phaser'
import DanielForwardPressDebugPage from './debug/DanielForwardPressDebugPage'
import DanielForwardBendDebugPage from './debug/DanielForwardBendDebugPage'
import DanielLeftSideBendDebugPage from './debug/DanielLeftSideBendDebugPage'
import DanielRightSideBendDebugPage from './debug/DanielRightSideBendDebugPage'
import DanielStretchDebugPage from './debug/DanielStretchDebugPage'
import DanielUpwardPressDebugPage from './debug/DanielUpwardPressDebugPage'
import CanvasRecorderDebugPage from './debug/CanvasRecorderDebugPage'
import DiagonalBodyPunchDebugPage from './debug/DiagonalBodyPunchDebugPage'
import DiagonalFacePunchDebugPage from './debug/DiagonalFacePunchDebugPage'
import MarchDebugPage from './debug/MarchDebugPage'
import SideStepDebugPage from './debug/SideStepDebugPage'
import SquatDebugPage from './debug/SquatDebugPage'
import { ensureDemoAuthToken } from './auth/demoAuth'
import { AuthOverlay } from './features/auth'
import { ExerciseSessionListOverlay } from './features/exerciseSessions'
import { resolvePatientProfileIdOrFetch } from './features/exerciseSessions/patientProfile'
import { useLoginSession } from './features/loginSession'
import { queryClient } from './queryClient'

const DEBUG_MARCH_MODE = 'march'
const DEBUG_SIDE_STEP_MODE = 'side-step'
const DEBUG_DIAGONAL_BODY_PUNCH_MODE = 'diagonal-body-punch'
const DEBUG_DIAGONAL_FACE_PUNCH_MODE = 'diagonal-face-punch'
const DEBUG_SQUAT_MODE = 'squat'
const DEBUG_DANIEL_FORWARD_PRESS_MODE = 'daniel-forward-press'
const DEBUG_DANIEL_FORWARD_BEND_MODE = 'daniel-forward-bend'
const DEBUG_DANIEL_UPWARD_PRESS_MODE = 'daniel-upward-press'
const DEBUG_DANIEL_LEFT_SIDE_BEND_MODE = 'daniel-left-side-bend'
const DEBUG_DANIEL_RIGHT_SIDE_BEND_MODE = 'daniel-right-side-bend'
const DEBUG_DANIEL_STRETCH_MODE = 'daniel-stretch'
const DEBUG_CANVAS_RECORDER_MODE = 'canvas-recorder'

function App() {
  const params = new URLSearchParams(window.location.search)
  const debugMode = params.get('debug')
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const [showAuth, setShowAuth] = useState(false)
  const [showExerciseSessions, setShowExerciseSessions] = useState(false)
  const [patientProfileId, setPatientProfileId] = useState<number | undefined>(undefined)

  useLoginSession(patientProfileId)

  useEffect(() => {
    if (
      debugMode === DEBUG_MARCH_MODE ||
      debugMode === DEBUG_SIDE_STEP_MODE ||
      debugMode === DEBUG_DIAGONAL_BODY_PUNCH_MODE ||
      debugMode === DEBUG_DIAGONAL_FACE_PUNCH_MODE ||
      debugMode === DEBUG_SQUAT_MODE ||
      debugMode === DEBUG_DANIEL_FORWARD_PRESS_MODE ||
      debugMode === DEBUG_DANIEL_FORWARD_BEND_MODE ||
      debugMode === DEBUG_DANIEL_UPWARD_PRESS_MODE ||
      debugMode === DEBUG_DANIEL_LEFT_SIDE_BEND_MODE ||
      debugMode === DEBUG_DANIEL_RIGHT_SIDE_BEND_MODE ||
      debugMode === DEBUG_DANIEL_STRETCH_MODE ||
      debugMode === DEBUG_CANVAS_RECORDER_MODE
    ) {
      return
    }
    if (!containerRef.current || gameRef.current) return

    let isCancelled = false

    void ensureDemoAuthToken().then(async () => {
      if (isCancelled || !containerRef.current || gameRef.current) return
      const game = createGame(containerRef.current)
      gameRef.current = game
      game.events.on('auth:request', () => setShowAuth(true))
      game.events.on('exercise-sessions:open', () => setShowExerciseSessions(true))

      const resolvedPatientProfileId = await resolvePatientProfileIdOrFetch()
      if (isCancelled) return
      setPatientProfileId(resolvedPatientProfileId)
    })

    return () => {
      isCancelled = true
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [debugMode])

  const handleAuthSuccess = useCallback(() => {
    setShowAuth(false)
    gameRef.current?.events.emit('auth:completed')
  }, [])

  const handleAuthCancel = useCallback(() => {
    setShowAuth(false)
    gameRef.current?.events.emit('auth:cancelled')
  }, [])

  if (debugMode === DEBUG_MARCH_MODE) {
    return <MarchDebugPage />
  }

  if (debugMode === DEBUG_SIDE_STEP_MODE) {
    return <SideStepDebugPage />
  }

  if (debugMode === DEBUG_DIAGONAL_BODY_PUNCH_MODE) {
    return <DiagonalBodyPunchDebugPage />
  }

  if (debugMode === DEBUG_DIAGONAL_FACE_PUNCH_MODE) {
    return <DiagonalFacePunchDebugPage />
  }

  if (debugMode === DEBUG_SQUAT_MODE) {
    return <SquatDebugPage />
  }

  if (debugMode === DEBUG_DANIEL_FORWARD_PRESS_MODE) {
    return <DanielForwardPressDebugPage />
  }

  if (debugMode === DEBUG_DANIEL_FORWARD_BEND_MODE) {
    return <DanielForwardBendDebugPage />
  }

  if (debugMode === DEBUG_DANIEL_UPWARD_PRESS_MODE) {
    return <DanielUpwardPressDebugPage />
  }

  if (debugMode === DEBUG_DANIEL_LEFT_SIDE_BEND_MODE) {
    return <DanielLeftSideBendDebugPage />
  }

  if (debugMode === DEBUG_DANIEL_RIGHT_SIDE_BEND_MODE) {
    return <DanielRightSideBendDebugPage />
  }

  if (debugMode === DEBUG_DANIEL_STRETCH_MODE) {
    return <DanielStretchDebugPage />
  }

  if (debugMode === DEBUG_CANVAS_RECORDER_MODE) {
    return <CanvasRecorderDebugPage />
  }

  return (
    <>
      <div
        ref={containerRef}
        style={{
          width: '100vw',
          height: '100vh',
          overflow: 'hidden',
          overscrollBehavior: 'none',
          touchAction: 'none',
          userSelect: 'none',
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
        }}
      />
      <AuthOverlay open={showAuth} onAuthSuccess={handleAuthSuccess} onCancel={handleAuthCancel} />
      <QueryClientProvider client={queryClient}>
        <ExerciseSessionListOverlay
          open={showExerciseSessions}
          onClose={() => setShowExerciseSessions(false)}
        />
      </QueryClientProvider>
    </>
  )
}

export default App
