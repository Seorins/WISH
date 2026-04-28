import { useEffect, useRef } from 'react'
import { createGame } from './phaser'
import type Phaser from 'phaser'
import MarchDebugPage from './debug/MarchDebugPage'

const DEBUG_MARCH_MODE = 'march'

function App() {
  const params = new URLSearchParams(window.location.search)
  const debugMode = params.get('debug')
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)

  useEffect(() => {
    if (debugMode === DEBUG_MARCH_MODE) return
    if (!containerRef.current || gameRef.current) return
    gameRef.current = createGame(containerRef.current)
    return () => {
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [debugMode])

  if (debugMode === DEBUG_MARCH_MODE) {
    return <MarchDebugPage />
  }

  return <div ref={containerRef} style={{ width: '100vw', height: '100vh', overflow: 'hidden' }} />
}

export default App
