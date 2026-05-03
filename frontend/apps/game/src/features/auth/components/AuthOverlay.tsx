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

const AUTH_OVERLAY_CSS = `
@keyframes auth-backdrop-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes auth-card-in {
  0% { opacity: 0; transform: scale(0.92) translateY(-14px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
.auth-backdrop {
  animation: auth-backdrop-in 200ms ease-out;
}
.auth-card {
  animation: auth-card-in 280ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.auth-input:focus {
  border-color: #5a3818;
  box-shadow: 0 0 0 3px rgba(139, 90, 43, 0.25);
}
.auth-primary:hover:not(:disabled) {
  filter: brightness(1.06);
  transform: translateY(-1px);
}
.auth-primary:active:not(:disabled) {
  transform: translateY(2px);
  box-shadow:
    inset 0 1px 0 rgba(255, 220, 150, 0.55),
    inset 0 -2px 0 rgba(110, 55, 18, 0.45),
    0 2px 0 #6e3712,
    0 3px 6px rgba(0,0,0,0.3);
}
.auth-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow:
    inset 0 1px 0 rgba(255, 220, 150, 0.3),
    0 4px 0 #6e3712;
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

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onCancel()
  }

  if (!open) return null

  return (
    <>
      <style>{AUTH_OVERLAY_CSS}</style>
      <div className="auth-backdrop" style={authStyles.backdrop} onClick={handleBackdropClick}>
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
