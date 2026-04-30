import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { signup as signupApi } from '@wish/api-client'

const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/

const signupSchema = z.object({
  email: z.string().email('올바른 이메일을 입력하세요').max(100, '100자 이하'),
  nickname: z.string().min(2, '2자 이상').max(30, '30자 이하'),
  password: z
    .string()
    .min(8, '8자 이상')
    .max(64, '64자 이하')
    .regex(PASSWORD_PATTERN, '영문/숫자/특수문자 각 1개 이상 포함'),
})

type SignupForm = z.infer<typeof signupSchema>

export function SignupPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { register, handleSubmit, formState } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', nickname: '', password: '' },
  })

  const onSubmit = async (values: SignupForm) => {
    setError(null)
    setSubmitting(true)
    try {
      await signupApi(values)
      // 가입 성공 시 가입 이메일을 prefill 한 채로 로그인 화면으로.
      // 단, 가입은 항상 USER 라 admin 로그인은 거부된다 — 메시지로 안내.
      navigate('/login', {
        replace: true,
        state: { signedUpEmail: values.email },
      })
    } catch (err: unknown) {
      setError(extractMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit(onSubmit)} style={styles.form}>
        <h1 style={styles.title}>WISH Admin · 회원가입</h1>
        <p style={styles.note}>
          회원가입은 항상 <b>일반 사용자(USER)</b> 로 생성됩니다. 관리자 권한은 별도 절차로
          부여됩니다.
        </p>

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
          닉네임 (2~30자)
          <input
            autoComplete="username"
            {...register('nickname')}
            style={styles.input}
            disabled={submitting}
          />
          {formState.errors.nickname && (
            <span style={styles.error}>{formState.errors.nickname.message}</span>
          )}
        </label>

        <label style={styles.label}>
          비밀번호 (영문/숫자/특수문자 8~64자)
          <input
            type="password"
            autoComplete="new-password"
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
          {submitting ? '가입 중…' : '가입'}
        </button>

        <Link to="/login" style={styles.linkBack}>
          ← 로그인으로 돌아가기
        </Link>
      </form>
    </div>
  )
}

function extractMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const res = (
      err as { response?: { data?: { message?: string; errors?: Record<string, string> } } }
    ).response
    if (res?.data?.errors) {
      return Object.values(res.data.errors).join(' / ')
    }
    if (res?.data?.message) return res.data.message
  }
  if (err instanceof Error) return err.message
  return '가입 중 오류가 발생했습니다'
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
    width: 380,
    padding: 32,
    background: '#fff',
    borderRadius: 8,
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  title: { margin: 0, fontSize: 22, textAlign: 'center' },
  note: {
    margin: 0,
    padding: 10,
    background: '#fff8e1',
    borderRadius: 4,
    fontSize: 12,
    color: '#5a4a00',
  },
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
    background: '#2e7d32',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
  },
  linkBack: {
    textAlign: 'center',
    fontSize: 13,
    color: '#1976d2',
    textDecoration: 'none',
  },
}
