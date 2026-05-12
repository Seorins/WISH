import type {
  CounselingChoice,
  CounselingEndingType,
  CounselingScript,
  DailyActivityState,
} from './types'

export const defaultDailyActivityState: DailyActivityState = {
  completedActivityCount: 0,
  hasDoneAnyActivityToday: false,
  recommendedActivityLabel: '가벼운 활동',
}

export const ENDING_TYPE_BY_CHOICE_INTENT_ID: Record<string, CounselingEndingType> = {
  body_okay_now: 'GO_LIGHT_ACTIVITY',
  body_rest_quiet: 'REST_THEN_ACTIVITY',
  body_family_near: 'REST_ONLY',
  body_tell_adult: 'ASK_ADULT_FIRST',
  pain_tell_teacher: 'ASK_MEDICAL_FIRST',
  pain_point_place: 'ASK_HELP_FIRST',
  pain_hold_hand: 'REST_ONLY',
  procedure_now_okay: 'GO_LIGHT_ACTIVITY',
  procedure_family_near: 'REST_ONLY',
  procedure_teacher_near: 'ASK_MEDICAL_FIRST',
  procedure_hold_hand: 'REST_ONLY',
  procedure_ask_teacher: 'ASK_MEDICAL_FIRST',
  procedure_family_ask: 'ASK_HELP_FIRST',
  procedure_draw_question: 'EXPRESS_WITH_DRAWING',
  fatigue_okay: 'GO_LIGHT_ACTIVITY',
  rest_quiet: 'REST_THEN_ACTIVITY',
  rest_close_eyes: 'REST_THEN_ACTIVITY',
  rest_near_family: 'REST_ONLY',
  family_okay: 'GO_LIGHT_ACTIVITY',
  family_say_miss: 'SOCIAL_CONNECT',
  family_draw_picture: 'EXPRESS_WITH_DRAWING',
  family_stay_near: 'REST_ONLY',
  family_say_worry: 'ASK_HELP_FIRST',
  family_tell_teacher: 'ASK_MEDICAL_FIRST',
  family_show_drawing: 'EXPRESS_WITH_DRAWING',
  peer_okay_now: 'GO_LIGHT_ACTIVITY',
  peer_short_hi: 'SOCIAL_CONNECT',
  peer_send_drawing: 'EXPRESS_WITH_DRAWING',
  peer_talk_later: 'PRIVATE_OKAY',
  school_ask_family: 'ASK_HELP_FIRST',
  school_ask_friend: 'SOCIAL_CONNECT',
  school_later: 'PRIVATE_OKAY',
  expression_not_sure: 'NO_PRESSURE',
  expression_family: 'ASK_HELP_FIRST',
  expression_teacher: 'ASK_HELP_FIRST',
  expression_private: 'PRIVATE_OKAY',
  drawing_family: 'EXPRESS_WITH_DRAWING',
  drawing_teacher: 'EXPRESS_WITH_DRAWING',
  drawing_private: 'PRIVATE_OKAY',
  anger_pause: 'CALM_DOWN',
  anger_say_upset: 'ASK_HELP_FIRST',
  anger_call_help: 'ASK_HELP_FIRST',
}

const RESPONSE_LINES_BY_CHOICE_INTENT_ID: Partial<Record<string, string[]>> = {
  fatigue_much: ['그럴 땐 많이 쉬어도 괜찮아.', '몸이 피곤하다고 말해줘서 고마워.'],
  expression_not_sure: ['아직 몰라도 괜찮아.', '마음이 정리될 때까지 기다려도 돼.'],
  anger_pause: ['좋아. 잠깐 멈추는 것도 방법이야.', '숨을 고르면 마음이 조금 가라앉을 수 있어.'],
}

export function buildActivityAwareEndingLines({
  endingType,
  dailyActivityState,
}: {
  endingType?: CounselingEndingType
  dailyActivityState: DailyActivityState
}): string[] {
  const hasActivity = dailyActivityState.hasDoneAnyActivityToday
  const activityLabel = dailyActivityState.recommendedActivityLabel ?? '가벼운 활동'

  switch (endingType) {
    case 'GO_LIGHT_ACTIVITY':
      return hasActivity
        ? ['오늘 해본 것도 있으니까, 이제는 천천히 가도 괜찮아.']
        : [`그럼 오늘은 ${activityLabel} 하나 가볍게 해볼까?`]

    case 'REST_THEN_ACTIVITY':
      return hasActivity
        ? ['오늘은 이 정도면 충분해.', '잠깐 쉬어가도 괜찮아.']
        : ['먼저 조금 쉬어도 돼.', `괜찮아지면 ${activityLabel} 하나만 해보자.`]

    case 'REST_ONLY':
      return ['지금은 쉬는 것도 좋은 선택이야.', '천천히 가도 괜찮아.']

    case 'ASK_HELP_FIRST':
      return ['혼자 참지 않아도 돼.', '가까운 사람에게 말해도 괜찮아.']

    case 'ASK_ADULT_FIRST':
      return ['가까운 어른에게 말하면 같이 도와줄 수 있어.', '그다음에 천천히 해도 돼.']

    case 'ASK_MEDICAL_FIRST':
      return ['선생님께 알려주면 도와줄 수 있어.', '활동은 천천히 해도 괜찮아.']

    case 'EXPRESS_WITH_DRAWING':
      return hasActivity
        ? ['그림으로 표현해도 괜찮아.', '오늘은 네 방식대로 해도 돼.']
        : ['말이 어려우면 그림으로 해도 괜찮아.', '오늘은 미술 활동으로 남겨봐도 좋아.']

    case 'SOCIAL_CONNECT':
      return hasActivity
        ? ['짧게 전해도 괜찮아.', '오늘은 천천히 쉬어가자.']
        : ['짧은 인사도 마음이 전해질 수 있어.', '괜찮으면 그림이나 짧은 활동으로 남겨봐도 좋아.']

    case 'PRIVATE_OKAY':
      return ['지금은 혼자 알고 있어도 괜찮아.', '말하고 싶을 때 다시 꺼내도 돼.']

    case 'CALM_DOWN':
      return hasActivity
        ? ['잠깐 멈추는 것도 좋은 방법이야.', '오늘은 천천히 쉬어가자.']
        : ['잠깐 멈추고 쉬어도 괜찮아.', `괜찮아지면 ${activityLabel}부터 가볍게 해보자.`]

    case 'NO_PRESSURE':
    default:
      return hasActivity
        ? ['오늘은 네 속도대로 가도 괜찮아.']
        : [`괜찮으면 ${activityLabel} 하나만 가볍게 해보자.`]
  }
}

export function getTodayActivityState(activityState?: DailyActivityState): DailyActivityState {
  if (!activityState) return defaultDailyActivityState

  return {
    ...defaultDailyActivityState,
    ...activityState,
    hasDoneAnyActivityToday:
      activityState.hasDoneAnyActivityToday || activityState.completedActivityCount > 0,
  }
}

export function getChoiceEndingType(choice: CounselingChoice): CounselingEndingType | undefined {
  return choice.endingType ?? ENDING_TYPE_BY_CHOICE_INTENT_ID[choice.choiceIntentId]
}

export function applyActivityAwareEndingTypes(scripts: CounselingScript[]): CounselingScript[] {
  return scripts.map(script => ({
    ...script,
    nodes: Object.fromEntries(
      Object.entries(script.nodes).map(([nodeId, node]) => [
        nodeId,
        {
          ...node,
          choices: node.choices.map(choice => {
            const choiceWithoutLegacyEnding = { ...choice }

            return {
              ...choiceWithoutLegacyEnding,
              endingType: getChoiceEndingType(choice),
              responseLines:
                RESPONSE_LINES_BY_CHOICE_INTENT_ID[choice.choiceIntentId] ?? choice.responseLines,
            }
          }),
        },
      ]),
    ),
  }))
}
