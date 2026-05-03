import { useCallback, useEffect, useState } from 'react'
import { assetPath } from '@/game/assets/assetPath'
import { LoginScreen } from './LoginScreen'
import { SignupScreen } from './SignupScreen'
import { authStyles } from './authStyles'

const PIXEL_FONT_URL = assetPath('fonts/galmuri11.woff2')

type AuthMode = 'login' | 'signup'

type AuthOverlayProps = {
  open: boolean
  onAuthSuccess: () => void
  onCancel: () => void
  initialMode?: AuthMode
}

const AUTH_OVERLAY_CSS = `
@font-face {
  font-family: 'Galmuri11';
  src: url('${PIXEL_FONT_URL}') format('woff2');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
@keyframes auth-card-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.auth-card {
  animation: auth-card-in 220ms ease-out;
}
.auth-input:focus {
  border-color: #5a3818;
}
.auth-primary:hover:not(:disabled) {
  background: #d76a1f;
}
.auth-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.auth-link:hover:not(:disabled) {
  text-decoration: underline;
}
.auth-link:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.auth-close:hover {
  color: #c25a17;
}
`

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

  if (!open) return null

  return (
    <>
      <style>{AUTH_OVERLAY_CSS}</style>
      <div style={authStyles.backdrop}>
        <div className="auth-card" style={authStyles.card}>
          <button
            type="button"
            aria-label="닫기"
            onClick={onCancel}
            className="auth-close"
            style={authStyles.closeButton}
          >
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
    </>
  )
}
