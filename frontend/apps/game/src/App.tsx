import { useEffect, useRef } from 'react'
import { createGame } from './phaser'
import type Phaser from 'phaser'

function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return
    gameRef.current = createGame(containerRef.current)
    return () => {
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [])

  return <div ref={containerRef} style={{ width: '100vw', height: '100vh', overflow: 'hidden' }} />
}

export default App
