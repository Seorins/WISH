import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { login as loginApi, signup as signupApi } from '@wish/api-client'
import { useAuthStore } from '../store'
import { extractAuthErrorMessage } from '../errors'
import { authStyles } from './authStyles'

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

type SignupScreenProps = {
  onAuthSuccess: () => void
  onSwitchToLogin: (prefillEmail?: string) => void
}

export function SignupScreen({ onAuthSuccess, onSwitchToLogin }: SignupScreenProps) {
  const setToken = useAuthStore(state => state.setToken)
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
    } catch (err) {
      setError(extractAuthErrorMessage(err, '가입 중 오류가 발생했습니다'))
      setSubmitting(false)
      return
    }

    // 가입 직후 동일 자격증명으로 자동 로그인 시도. 실패 시 로그인 화면으로 이메일 prefill.
    try {
      const response = await loginApi({ email: values.email, password: values.password })
      setToken(response.data.accessToken)
      onAuthSuccess()
    } catch {
      onSwitchToLogin(values.email)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={authStyles.form}>
      <h2 style={authStyles.title}>회원가입</h2>

      <label style={authStyles.label}>
        이메일
        <input
          type="email"
          autoComplete="email"
          {...register('email')}
          style={authStyles.input}
          disabled={submitting}
        />
        {formState.errors.email && (
          <span style={authStyles.error}>{formState.errors.email.message}</span>
        )}
      </label>

      <label style={authStyles.label}>
        닉네임 (2~30자)
        <input
          autoComplete="username"
          {...register('nickname')}
          style={authStyles.input}
          disabled={submitting}
        />
        {formState.errors.nickname && (
          <span style={authStyles.error}>{formState.errors.nickname.message}</span>
        )}
      </label>

      <label style={authStyles.label}>
        비밀번호 (영문/숫자/특수문자 8~64자)
        <input
          type="password"
          autoComplete="new-password"
          {...register('password')}
          style={authStyles.input}
          disabled={submitting}
        />
        {formState.errors.password && (
          <span style={authStyles.error}>{formState.errors.password.message}</span>
        )}
      </label>

      {error && <div style={authStyles.errorBox}>{error}</div>}

      <button type="submit" style={authStyles.primaryButton} disabled={submitting}>
        {submitting ? '가입 중…' : '가입하기'}
      </button>

      <button
        type="button"
        onClick={() => onSwitchToLogin()}
        style={authStyles.linkButton}
        disabled={submitting}
      >
        이미 계정이 있으신가요? <strong>로그인</strong>
      </button>
    </form>
  )
}
