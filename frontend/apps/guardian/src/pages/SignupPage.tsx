import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { createPatientProfile, login as loginApi, signup as signupApi } from '@wish/api-client'
import { useAuthStore } from '@/shared/auth/store'
import logoImage from '@/assets/logo.png'
import modelImage from '@/assets/model.png'
import styles from './SignupPage.module.css'

const signupSchema = z.object({
  email: z.string().email('올바른 이메일을 입력하세요'),
  nickname: z.string().min(2, '2~30자로 입력하세요').max(30, '2~30자로 입력하세요'),
  password: z
    .string()
    .min(8, '8~64자, 영문/숫자/특수문자 포함')
    .max(64, '8~64자, 영문/숫자/특수문자 포함')
    .regex(/[a-zA-Z]/, '영문 포함')
    .regex(/[0-9]/, '숫자 포함')
    .regex(/[!@#$%^&*]/, '특수문자(!@#$%^&*) 포함'),
  name: z.string().min(1, '이름을 입력하세요').max(50, '50자 이내로 입력하세요'),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '생년월일을 입력하세요')
    .refine(value => new Date(value) < new Date(), { message: '오늘 이전 날짜를 입력하세요' }),
  gender: z.enum(['MALE', 'FEMALE'], { required_error: '성별을 선택하세요' }),
})

type SignupForm = z.infer<typeof signupSchema>

const GENDER_OPTIONS: { value: SignupForm['gender']; label: string }[] = [
  { value: 'MALE', label: '남자' },
  { value: 'FEMALE', label: '여자' },
]

export function SignupPage() {
  const navigate = useNavigate()
  const { setToken, token } = useAuthStore()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { register, handleSubmit, formState, setValue, watch } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: '',
      nickname: '',
      password: '',
      name: '',
      birthDate: '',
      gender: undefined,
    },
  })

  const selectedGender = watch('gender')

  useEffect(() => {
    if (token) {
      navigate('/', { replace: true })
    }
  }, [token, navigate])

  const onSubmit = async (values: SignupForm) => {
    setError(null)
    setSubmitting(true)
    try {
      await signupApi({
        email: values.email,
        nickname: values.nickname,
        password: values.password,
      })

      const tokenResponse = await loginApi({
        email: values.email,
        password: values.password,
      })
      setToken(tokenResponse.data.accessToken)

      await createPatientProfile({
        name: values.name,
        nickname: values.nickname,
        birthDate: values.birthDate,
        gender: values.gender,
      })

      navigate('/', { replace: true })
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? '회원가입 처리 중 오류가 발생했습니다. 다시 시도해주세요.'
          : '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.cardWrapper}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <img src={logoImage} alt="WISH" className={styles.logo} />
              <Link to="/login" className={styles.loginLink}>
                이미 계정이 있으신가요?
                <strong>로그인</strong>
              </Link>
            </div>

            <h1 className={styles.title}>회원가입</h1>

            <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
              <div className={styles.field}>
                <span className={styles.label}>이메일</span>
                <input
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                  className={styles.input}
                  disabled={submitting}
                  placeholder="example@email.com"
                />
                {formState.errors.email && (
                  <span className={styles.errorText}>{formState.errors.email.message}</span>
                )}
              </div>

              <div className={styles.field}>
                <span className={styles.label}>비밀번호</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  {...register('password')}
                  className={styles.input}
                  disabled={submitting}
                  placeholder="영문/숫자/특수문자 포함 8자 이상"
                />
                {formState.errors.password && (
                  <span className={styles.errorText}>{formState.errors.password.message}</span>
                )}
              </div>

              <div className={styles.field}>
                <span className={styles.label}>닉네임</span>
                <input
                  type="text"
                  autoComplete="nickname"
                  {...register('nickname')}
                  className={styles.input}
                  disabled={submitting}
                  placeholder="2~30자"
                />
                {formState.errors.nickname && (
                  <span className={styles.errorText}>{formState.errors.nickname.message}</span>
                )}
              </div>

              <div className={styles.field}>
                <span className={styles.label}>이름</span>
                <input
                  type="text"
                  autoComplete="name"
                  {...register('name')}
                  className={styles.input}
                  disabled={submitting}
                  placeholder="실명"
                />
                {formState.errors.name && (
                  <span className={styles.errorText}>{formState.errors.name.message}</span>
                )}
              </div>

              <div className={styles.row}>
                <div className={styles.field}>
                  <span className={styles.label}>생년월일</span>
                  <input
                    type="date"
                    {...register('birthDate')}
                    className={styles.input}
                    disabled={submitting}
                  />
                  {formState.errors.birthDate && (
                    <span className={styles.errorText}>{formState.errors.birthDate.message}</span>
                  )}
                </div>

                <div className={styles.field}>
                  <span className={styles.label}>성별</span>
                  <div className={styles.genderGroup}>
                    {GENDER_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        disabled={submitting}
                        onClick={() => setValue('gender', option.value, { shouldValidate: true })}
                        className={`${styles.genderOption} ${
                          selectedGender === option.value ? styles.genderOptionActive : ''
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {formState.errors.gender && (
                    <span className={styles.errorText}>{formState.errors.gender.message}</span>
                  )}
                </div>
              </div>

              {error && <div className={styles.errorBox}>{error}</div>}

              <button type="submit" className={styles.submit} disabled={submitting}>
                {submitting ? '가입 중…' : '회원가입'}
              </button>
            </form>
          </div>
        </div>

        <div className={styles.illustrationWrapper}>
          <img src={modelImage} alt="" className={styles.illustration} />
        </div>
      </div>
    </div>
  )
}
