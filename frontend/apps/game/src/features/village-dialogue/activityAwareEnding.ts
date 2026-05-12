import type {
  CounselingChoice,
  CounselingEndingType,
  CounselingScript,
  DailyActivityState,
  VillagerNpcId,
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
  rest_quiet: 'REST_THEN_ACTIVITY',
  rest_close_eyes: 'REST_ONLY',
  rest_near_family: 'REST_ONLY',
  peer_okay_now: 'GO_LIGHT_ACTIVITY',
  peer_short_hi: 'SOCIAL_CONNECT',
  peer_draw: 'EXPRESS_WITH_DRAWING',
  peer_talk_later: 'PRIVATE_OKAY',
  school_ask_family: 'ASK_HELP_FIRST',
  school_ask_friend: 'SOCIAL_CONNECT',
  school_later: 'PRIVATE_OKAY',
  hospital_okay: 'GO_LIGHT_ACTIVITY',
  hospital_family_near: 'REST_ONLY',
  hospital_teacher_explain: 'ASK_MEDICAL_FIRST',
  hospital_hold_hand: 'REST_ONLY',
  hospital_ask_teacher: 'ASK_MEDICAL_FIRST',
  hospital_ask_family: 'ASK_HELP_FIRST',
  hospital_draw_question: 'EXPRESS_WITH_DRAWING',
  family_say_worry: 'ASK_HELP_FIRST',
  family_tell_teacher: 'ASK_MEDICAL_FIRST',
  family_show_drawing: 'EXPRESS_WITH_DRAWING',
  anger_pause: 'CALM_DOWN',
  anger_say_upset: 'ASK_HELP_FIRST',
  anger_call_help: 'ASK_HELP_FIRST',
}

export function buildActivityAwareEndingLines({
  endingType,
  npcId,
  dailyActivityState,
}: {
  endingType?: CounselingEndingType
  npcId: VillagerNpcId
  dailyActivityState: DailyActivityState
}): string[] {
  const hasActivity = dailyActivityState.hasDoneAnyActivityToday
  const activityLabel = dailyActivityState.recommendedActivityLabel ?? '가벼운 활동'

  const activityStartByNpc: Record<VillagerNpcId, string> = {
    nurse_bunny: `괜찮으면 ${activityLabel} 하나 가볍게 해볼까?`,
    sleepy_sheep: `괜찮으면 ${activityLabel} 하나만 천천히 해보자.`,
    gardener_bear: `씨앗만큼 작게 ${activityLabel}부터 시작해볼까?`,
    monkey_friend: `좋아! ${activityLabel}부터 살짝 해볼까?`,
    squirrel_friend: `괜찮으면 ${activityLabel} 하나만 해봐도 돼.`,
    dain: `그럼 ${activityLabel} 하나 가볍게 해볼까?`,
  }

  const alreadyDidByNpc: Record<VillagerNpcId, string> = {
    nurse_bunny: '오늘은 이미 해본 게 있으니까, 잠깐 쉬어도 괜찮아.',
    sleepy_sheep: '오늘은 이 정도면 충분해. 천천히 쉬어가자.',
    gardener_bear: '오늘은 작게 잘 해냈어. 이제 쉬어가도 괜찮아.',
    monkey_friend: '오늘 해본 것도 있으니까, 이제 코몽이랑 쉬자!',
    squirrel_friend: '오늘은 네 속도대로 가도 괜찮아.',
    dain: '오늘은 이미 해본 게 있으니까, 천천히 쉬어가도 괜찮아.',
  }

  switch (endingType) {
    case 'GO_LIGHT_ACTIVITY':
      return hasActivity ? [alreadyDidByNpc[npcId]] : [activityStartByNpc[npcId]]

    case 'REST_THEN_ACTIVITY':
      return hasActivity
        ? [alreadyDidByNpc[npcId]]
        : ['먼저 조금 쉬어가자.', `괜찮아지면 ${activityLabel} 하나만 해보자.`]

    case 'REST_ONLY':
      return ['지금은 쉬는 것도 좋은 선택이야.', '오늘은 네 속도대로 가자.']

    case 'ASK_HELP_FIRST':
      return ['혼자 들고 있지 않아도 돼.', '가까운 사람에게 말해도 괜찮아.']

    case 'ASK_ADULT_FIRST':
      return ['먼저 가까운 사람에게 알려보자.', '그다음에 천천히 해도 괜찮아.']

    case 'ASK_MEDICAL_FIRST':
      return ['먼저 선생님께 알려보자.', '활동은 천천히 해도 괜찮아.']

    case 'EXPRESS_WITH_DRAWING':
      return ['말이 어려우면 그림으로 해도 돼.', '오늘은 미술 활동으로 남겨봐도 좋아.']

    case 'SOCIAL_CONNECT':
      return ['짧게 전해도 괜찮아.', '부담 없을 때 해도 돼.']

    case 'PRIVATE_OKAY':
      return ['지금은 혼자 알고 있어도 괜찮아.', '말하고 싶을 때 다시 꺼내도 돼.']

    case 'CALM_DOWN':
      return hasActivity
        ? ['오늘은 천천히 쉬어가자.']
        : ['잠깐 쉬고 나서, 괜찮아지면 가벼운 활동 하나만 해보자.']

    case 'NO_PRESSURE':
    default:
      return hasActivity ? [alreadyDidByNpc[npcId]] : [activityStartByNpc[npcId]]
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
          choices: node.choices.map(choice => ({
            ...choice,
            endingType: getChoiceEndingType(choice),
            responseLines: choice.responseLines ?? choice.fallbackResponseLines,
          })),
        },
      ]),
    ),
  }))
}
