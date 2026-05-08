import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { login as loginApi } from '@wish/api-client'
import { decodeJwt } from '../shared/auth/jwt'
import { useAuthStore } from '../shared/auth/store'

const loginSchema = z.object({
  email: z.string().email('올바른 이메일을 입력하세요'),
  password: z.string().min(1, '비밀번호를 입력하세요'),
})

type LoginForm = z.infer<typeof loginSchema>

export function LoginPage() {
  const navigate = useNavigate()
  const { setToken, clear, isAdmin, token } = useAuthStore()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { register, handleSubmit, formState } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  useEffect(() => {
    if (token && isAdmin) {
      navigate('/motions', { replace: true })
    }
  }, [token, isAdmin, navigate])

  const onSubmit = async (values: LoginForm) => {
    setError(null)
    setSubmitting(true)
    try {
      const response = await loginApi(values)
      const newToken = response.data.accessToken
      const payload = decodeJwt(newToken)
      if (payload?.role !== 'ADMIN') {
        // 토큰은 받았지만 ADMIN 이 아니면 저장하지 않고 거부.
        clear()
        setError('관리자 권한이 없는 계정입니다')
        return
      }
      setToken(newToken)
      navigate('/motions', { replace: true })
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? '이메일 또는 비밀번호가 올바르지 않습니다'
          : '로그인 중 오류가 발생했습니다'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit(onSubmit)} style={styles.form}>
        <h1 style={styles.title}>WISH Admin</h1>

        <label style={styles.label}>
          이메일
          <input
            type="email"
            autoComplete="email"
            {...register('email')}
            style={styles.input}
            disabled={submitting}
          />
          {formState.errors.email && (
            <span style={styles.error}>{formState.errors.email.message}</span>
          )}
        </label>

        <label style={styles.label}>
          비밀번호
          <input
            type="password"
            autoComplete="current-password"
            {...register('password')}
            style={styles.input}
            disabled={submitting}
          />
          {formState.errors.password && (
            <span style={styles.error}>{formState.errors.password.message}</span>
          )}
        </label>

        {error && <div style={styles.errorBox}>{error}</div>}

        <button type="submit" style={styles.submit} disabled={submitting}>
          {submitting ? '로그인 중…' : '로그인'}
        </button>
      </form>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f5f5f5',
  },
  form: {
    width: 360,
    padding: 32,
    background: '#fff',
    borderRadius: 8,
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  title: { margin: 0, fontSize: 24, textAlign: 'center' },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14 },
  input: {
    padding: '8px 10px',
    fontSize: 14,
    border: '1px solid #ccc',
    borderRadius: 4,
  },
  error: { color: '#d32f2f', fontSize: 12 },
  errorBox: {
    padding: 10,
    background: '#fdecea',
    color: '#d32f2f',
    borderRadius: 4,
    fontSize: 13,
  },
  submit: {
    padding: '10px 14px',
    fontSize: 15,
    background: '#1976d2',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
  },
}
