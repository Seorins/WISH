type SpeakFeedbackOptions = {
  lang?: string
  rate?: number
  pitch?: number
  volume?: number
}

function getSpeechSynthesis() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return null
  }

  return window.speechSynthesis
}

export function speakFeedback(text: string, options: SpeakFeedbackOptions = {}) {
  const speechSynthesis = getSpeechSynthesis()
  if (!speechSynthesis) return

  speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = options.lang ?? 'ko-KR'
  utterance.rate = options.rate ?? 1
  utterance.pitch = options.pitch ?? 1
  utterance.volume = options.volume ?? 1

  speechSynthesis.speak(utterance)
}

export function stopFeedbackSpeech() {
  const speechSynthesis = getSpeechSynthesis()
  if (!speechSynthesis) return

  speechSynthesis.cancel()
}
