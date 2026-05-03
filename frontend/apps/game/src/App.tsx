import { useCallback, useEffect, useRef, useState } from 'react'
import { createGame } from './phaser'
import type Phaser from 'phaser'
import DiagonalBodyPunchDebugPage from './debug/DiagonalBodyPunchDebugPage'
import DiagonalFacePunchDebugPage from './debug/DiagonalFacePunchDebugPage'
import MarchDebugPage from './debug/MarchDebugPage'
import SideStepDebugPage from './debug/SideStepDebugPage'
import SquatDebugPage from './debug/SquatDebugPage'
import { ensureDemoAuthToken } from './auth/demoAuth'
import { AuthOverlay } from './features/auth'

const DEBUG_MARCH_MODE = 'march'
const DEBUG_SIDE_STEP_MODE = 'side-step'
const DEBUG_DIAGONAL_BODY_PUNCH_MODE = 'diagonal-body-punch'
const DEBUG_DIAGONAL_FACE_PUNCH_MODE = 'diagonal-face-punch'
const DEBUG_SQUAT_MODE = 'squat'

function App() {
  const params = new URLSearchParams(window.location.search)
  const debugMode = params.get('debug')
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const [showAuth, setShowAuth] = useState(false)

  useEffect(() => {
    if (
      debugMode === DEBUG_MARCH_MODE ||
      debugMode === DEBUG_SIDE_STEP_MODE ||
      debugMode === DEBUG_DIAGONAL_BODY_PUNCH_MODE ||
      debugMode === DEBUG_DIAGONAL_FACE_PUNCH_MODE ||
      debugMode === DEBUG_SQUAT_MODE
    ) {
      return
    }
    if (!containerRef.current || gameRef.current) return

    let isCancelled = false

    void ensureDemoAuthToken().then(() => {
      if (isCancelled || !containerRef.current || gameRef.current) return
      const game = createGame(containerRef.current)
      gameRef.current = game
      game.events.on('auth:request', () => setShowAuth(true))
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
    </>
  )
}

export default App
