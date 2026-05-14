import { useCallback, useEffect, useRef, useState } from 'react'

export type SpeechRecognitionStatus = 'idle' | 'listening' | 'denied' | 'error'

interface UseSpeechRecognitionOptions {
  lang?: string
  onFinalResult?: (transcript: string) => void
}

interface UseSpeechRecognitionResult {
  supported: boolean
  status: SpeechRecognitionStatus
  finalTranscript: string
  interimTranscript: string
  errorMessage: string | null
  start: () => void
  stop: () => void
  reset: () => void
}

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

interface SpeechRecognitionEventLike {
  resultIndex: number
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>
}

interface SpeechRecognitionErrorEventLike {
  error: string
  message?: string
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function resolveSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function useSpeechRecognition({
  lang = 'ko-KR',
  onFinalResult,
}: UseSpeechRecognitionOptions = {}): UseSpeechRecognitionResult {
  const ctor = resolveSpeechRecognitionCtor()
  const supported = ctor !== null

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const finalTranscriptRef = useRef('')
  const onFinalResultRef = useRef(onFinalResult)

  const [status, setStatus] = useState<SpeechRecognitionStatus>('idle')
  const [finalTranscript, setFinalTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    onFinalResultRef.current = onFinalResult
  }, [onFinalResult])

  useEffect(() => {
    if (!ctor) return
    const recognition = new ctor()
    recognition.lang = lang
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setStatus('listening')
      setErrorMessage(null)
    }

    recognition.onresult = event => {
      let interim = ''
      let appendedFinal = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        const transcript = result[0]?.transcript ?? ''
        if (result.isFinal) {
          appendedFinal += transcript
        } else {
          interim += transcript
        }
      }
      if (appendedFinal) {
        finalTranscriptRef.current = (finalTranscriptRef.current + appendedFinal).trim()
        setFinalTranscript(finalTranscriptRef.current)
      }
      setInterimTranscript(interim)
    }

    recognition.onerror = event => {
      if (event.error === 'no-speech' || event.error === 'aborted') {
        setStatus('idle')
        return
      }
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setStatus('denied')
        setErrorMessage('마이크 권한이 필요해요.')
        return
      }
      setStatus('error')
      setErrorMessage(event.message || event.error || '음성 인식 오류가 발생했어요.')
    }

    recognition.onend = () => {
      setStatus(prev => (prev === 'listening' ? 'idle' : prev))
      setInterimTranscript('')
      const collected = finalTranscriptRef.current.trim()
      if (collected.length > 0) {
        onFinalResultRef.current?.(collected)
      }
    }

    recognitionRef.current = recognition
    return () => {
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      recognition.onstart = null
      try {
        recognition.abort()
      } catch {
        // noop
      }
      recognitionRef.current = null
    }
  }, [ctor, lang])

  const start = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition) return
    finalTranscriptRef.current = ''
    setFinalTranscript('')
    setInterimTranscript('')
    setErrorMessage(null)
    try {
      recognition.start()
    } catch {
      setStatus('idle')
    }
  }, [])

  const stop = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition) return
    try {
      recognition.stop()
    } catch {
      // noop
    }
  }, [])

  const reset = useCallback(() => {
    finalTranscriptRef.current = ''
    setFinalTranscript('')
    setInterimTranscript('')
    setErrorMessage(null)
    setStatus('idle')
  }, [])

  return {
    supported,
    status,
    finalTranscript,
    interimTranscript,
    errorMessage,
    start,
    stop,
    reset,
  }
}
