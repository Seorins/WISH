export type TaekwondoContentMode = 'practice'

export type SeokjaeSelectDialogStage = 'greeting' | 'choice-prompt'

export type SeokjaeContentDialogStage = 'confirm'

export interface SeokjaeDialogLine {
  id: string
  text: string
}

export interface TaekwondoChoiceOption {
  mode: TaekwondoContentMode
  label: string
}

export const taekwondoChoiceOptions: TaekwondoChoiceOption[] = [
  { mode: 'practice', label: '시작하기' },
]

export const seokjaeSelectDialogs: Record<SeokjaeSelectDialogStage, SeokjaeDialogLine[]> = {
  greeting: [
    { id: 'seokjae-greeting-001', text: '좋아, 준비됐어? 몸도 마음도 반듯하게 세워보자.' },
    { id: 'seokjae-greeting-002', text: '어서 와. 오늘은 태권도 동작을 같이 연습해보자!' },
  ],
  'choice-prompt': [
    { id: 'seokjae-choice-001', text: '기본 자세부터 차근차근 해볼까?' },
    { id: 'seokjae-choice-002', text: '시작하면 내가 동작을 보여줄게. 따라 할 준비 됐지?' },
  ],
}

export const seokjaeContentDialogs: Record<
  TaekwondoContentMode,
  Record<SeokjaeContentDialogStage, SeokjaeDialogLine[]>
> = {
  practice: {
    confirm: [
      { id: 'seokjae-practice-confirm-001', text: '좋아! 태권도 연습을 시작해보자.' },
      { id: 'seokjae-practice-confirm-002', text: '멋진 기합으로 시작해보자. 하나, 둘!' },
    ],
  },
}
