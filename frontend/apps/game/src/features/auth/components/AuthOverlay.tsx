import { useCallback, useEffect, useState } from 'react'
import { LoginScreen } from './LoginScreen'
import { SignupScreen } from './SignupScreen'
import { authStyles } from './authStyles'

type AuthMode = 'login' | 'signup'

type AuthOverlayProps = {
  open: boolean
  onAuthSuccess: () => void
  onCancel: () => void
  initialMode?: AuthMode
}

export function AuthOverlay({
  open,
  onAuthSuccess,
  onCancel,
  initialMode = 'login',
}: AuthOverlayProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [prefillEmail, setPrefillEmail] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (open) {
      setMode(initialMode)
      setPrefillEmail(undefined)
    }
  }, [open, initialMode])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  const handleSwitchToSignup = useCallback(() => {
    setPrefillEmail(undefined)
    setMode('signup')
  }, [])

  const handleSwitchToLogin = useCallback((email?: string) => {
    setPrefillEmail(email)
    setMode('login')
  }, [])

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onCancel()
  }

  if (!open) return null

  return (
    <div style={authStyles.backdrop} onClick={handleBackdropClick}>
      <div style={authStyles.card}>
        <button type="button" aria-label="닫기" onClick={onCancel} style={authStyles.closeButton}>
          ✕
        </button>
        {mode === 'login' ? (
          <LoginScreen
            initialEmail={prefillEmail}
            onAuthSuccess={onAuthSuccess}
            onSwitchToSignup={handleSwitchToSignup}
          />
        ) : (
          <SignupScreen onAuthSuccess={onAuthSuccess} onSwitchToLogin={handleSwitchToLogin} />
        )}
      </div>
    </div>
  )
}
