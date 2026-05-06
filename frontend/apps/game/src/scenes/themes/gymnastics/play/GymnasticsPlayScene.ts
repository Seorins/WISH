import Phaser from 'phaser'
import {
  calculateAverageAccuracy,
  createExerciseSession,
  CREATE_EXERCISE_SESSION_ERROR_MESSAGE,
  type CreateExerciseSessionRequest,
  type ExerciseSessionDetail,
} from '@wish/api-client'
import { assetPath } from '@/game/assets/assetPath'
import { POSE_LANDMARK_NAMES, PoseTracker } from '@/game/motion/poseTracker'
import { fadeToScene } from '@/game/systems/sceneTransition'
import { addCoverBackground } from '@/game/world/background'
import { resolvePatientProfileId } from '@/features/exerciseSessions/patientProfile'
import {
  EXERCISE_SESSION_REPORT_QUERY_KEY,
  EXERCISE_SESSIONS_QUERY_KEY,
} from '@/features/exerciseSessions/hooks'
import {
  formatAccuracy,
  formatDurationSec,
  formatExerciseType,
} from '@/features/exerciseSessions/format'
import { queryClient } from '@/queryClient'

type GymnasticsMotion = {
  title: string
  goal: string
  tips: string[]
}

type PanelBounds = {
  x: number
  y: number
  width: number
  height: number
}

type GymnasticsMotionKind =
  | 'march'
  | 'side-step'
  | 'diagonal-body-punch'
  | 'diagonal-face-punch'
  | 'squat'

type DanielMotionKind =
  | 'daniel_forward_press'
  | 'daniel_upward_press'
  | 'daniel_side_bend_left'
  | 'daniel_side_bend_right'
  | 'daniel_forward_bend'

type TopAiMotionSpec = {
  type: 'top'
  kind: GymnasticsMotionKind
  exerciseMotionId: number
  targetSteps: number
}

type DanielAiMotionSpec = {
  type: 'daniel'
  kind: DanielMotionKind
  exerciseMotionId: number
  targetHoldMs: number
}

type AiMotionSpec = TopAiMotionSpec | DanielAiMotionSpec

type LocalExerciseMotionResult = {
  exerciseMotionId: number
  durationSec: number
  accuracy: number
  completedReps: number
  feedback: string
}

type LandmarkPayload = {
  name: string
  x: number
  y: number
  z?: number
  visibility?: number
}

type GymnasticsAiResponse = {
  state: string
  step_count?: number
  accuracy: number
  feedback: string | null
  tracking: string
  hold_duration_ms?: number
  hold_completed?: boolean
  hold_last_timestamp_ms?: number | null
  last_counted_side?: string | null
  last_seen_side?: string | null
  left_armed?: boolean
  right_armed?: boolean
  reference_hip_x: number | null
  reference_hip_y: number | null
  reference_scale: number | null
  displayed_feedback_code: string | null
  displayed_feedback_text: string | null
  displayed_feedback_frames: number
  candidate_feedback_code: string | null
  candidate_feedback_text: string | null
  candidate_feedback_streak: number
  representative_feedback_totals: Record<string, number>
  representative_feedback_code: string | null
  representative_feedback_text: string | null
  representative_feedback_frames: number
  baseline_left_step_extent?: number | null
  baseline_right_step_extent?: number | null
  baseline_ankle_span?: number | null
  baseline_left_wrist_forward?: number | null
  baseline_right_wrist_forward?: number | null
  baseline_stance_span?: number | null
}

type GymnasticsAiState = {
  previousState: string
  stepCount: number
  holdDurationMs: number
  holdCompleted: boolean
  holdLastTimestampMs: number | null
  lastCountedSide: string | null
  lastSeenSide: string | null
  leftArmed: boolean
  rightArmed: boolean
  referenceHipX: number | null
  referenceHipY: number | null
  referenceScale: number | null
  displayedFeedbackCode: string | null
  displayedFeedbackText: string | null
  displayedFeedbackFrames: number
  candidateFeedbackCode: string | null
  candidateFeedbackText: string | null
  candidateFeedbackStreak: number
  representativeFeedbackTotals: Record<string, number>
  representativeFeedbackCode: string | null
  representativeFeedbackText: string | null
  representativeFeedbackFrames: number
  baselineLeftStepExtent: number | null
  baselineRightStepExtent: number | null
  baselineAnkleSpan: number | null
  baselineLeftWristForward: number | null
  baselineRightWristForward: number | null
  baselineStanceSpan: number | null
  baselineLeftKneeY: number | null
  baselineRightKneeY: number | null
  baselineLeftWristZ: number | null
  baselineRightWristZ: number | null
  accuracy: number
  tracking: string
  feedback: string | null
  localPhase: 'ready' | 'active' | 'returning'
  lastLocalRepAtMs: number
}

const AI_BASE_URL = (import.meta.env.VITE_AI_BASE_URL ?? 'http://localhost:8001/api/v1').replace(
  /\/$/,
  '',
)
const GYMNASTICS_PLAY_BACKGROUND_TEXTURE_KEY = 'gymnastics-play-background-v3'

const TOP_AI_SEQUENCE: AiMotionSpec[] = [
  { type: 'top', kind: 'march', exerciseMotionId: 1, targetSteps: 8 },
  { type: 'top', kind: 'side-step', exerciseMotionId: 2, targetSteps: 8 },
  { type: 'top', kind: 'diagonal-body-punch', exerciseMotionId: 3, targetSteps: 8 },
  { type: 'top', kind: 'diagonal-face-punch', exerciseMotionId: 4, targetSteps: 8 },
  { type: 'top', kind: 'squat', exerciseMotionId: 5, targetSteps: 8 },
]

const DEFAULT_DANIEL_TARGET_HOLD_MS = 3000

const DANIEL_AI_SEQUENCE: AiMotionSpec[] = [
  {
    type: 'daniel',
    kind: 'daniel_forward_press',
    exerciseMotionId: 6,
    targetHoldMs: DEFAULT_DANIEL_TARGET_HOLD_MS,
  },
  {
    type: 'daniel',
    kind: 'daniel_upward_press',
    exerciseMotionId: 7,
    targetHoldMs: DEFAULT_DANIEL_TARGET_HOLD_MS,
  },
  {
    type: 'daniel',
    kind: 'daniel_side_bend_left',
    exerciseMotionId: 8,
    targetHoldMs: DEFAULT_DANIEL_TARGET_HOLD_MS,
  },
  {
    type: 'daniel',
    kind: 'daniel_side_bend_right',
    exerciseMotionId: 9,
    targetHoldMs: DEFAULT_DANIEL_TARGET_HOLD_MS,
  },
  {
    type: 'daniel',
    kind: 'daniel_forward_bend',
    exerciseMotionId: 10,
    targetHoldMs: DEFAULT_DANIEL_TARGET_HOLD_MS,
  },
]

const MOTION_ENDPOINTS: Record<GymnasticsMotionKind, string> = {
  march: 'march',
  'side-step': 'side-step',
  'diagonal-body-punch': 'diagonal-body-punch',
  'diagonal-face-punch': 'diagonal-face-punch',
  squat: 'squat',
}

export const TOP_MOTIONS: GymnasticsMotion[] = [
  {
    title: '팔 벌리기',
    goal: '양팔을 어깨 높이로 올려요',
    tips: ['양팔을 어깨 높이로', '시선은 정면', '다리는 그대로'],
  },
  {
    title: '무릎 올리기',
    goal: '무릎을 천천히 들어요',
    tips: ['등은 곧게 펴요', '무릎은 천천히', '숨은 편하게'],
  },
  {
    title: '가볍게 흔들기',
    goal: '몸을 부드럽게 움직여요',
    tips: ['작게 움직여도 좋아요', '아프면 쉬어요', '즐겁게 마무리'],
  },
]

const DANIEL_MOTIONS: GymnasticsMotion[] = [
  {
    title: '\uC190 \uAE4D\uC9C0 \uB07C\uACE0 \uC55E\uC73C\uB85C \uBC00\uAE30',
    goal: '\uC190\uC744 \uBAA8\uC544 \uC55E\uC73C\uB85C \uBC00\uACE0 \uC790\uC138\uB97C \uC720\uC9C0\uD574\uC694.',
    tips: [
      '\uC5B4\uAE68\uB97C \uC62C\uB9AC\uC9C0 \uC54A\uACE0 \uD314\uC744 \uC55E\uC73C\uB85C \uBC00\uC5B4\uC694.',
      '\uC190\uBAA9\uC740 \uC5B4\uAE68 \uB192\uC774\uC5D0 \uB9DE\uCD94\uC5B4\uC694.',
      '\uD5C8\uB9AC\uB294 \uBC18\uB4EF\uD558\uAC8C \uC138\uC6CC\uC694.',
    ],
  },
  {
    title: '\uC190 \uAE4D\uC9C0 \uB07C\uACE0 \uC704\uB85C \uBC00\uAE30',
    goal: '\uC190\uC744 \uC704\uB85C \uC62C\uB824 \uB298\uC5B4\uB098\uB294 \uC790\uC138\uB97C \uC720\uC9C0\uD574\uC694.',
    tips: [
      '\uD314\uAF08\uCE58\uB97C \uD3B4\uACE0 \uC190\uC744 \uB192\uAC8C \uC62C\uB824\uC694.',
      '\uC591\uC190 \uB192\uC774\uB97C \uBE44\uC2B7\uD558\uAC8C \uB9DE\uCD94\uC5B4\uC694.',
      '\uBAB8\uC774 \uD55C\uCABD\uC73C\uB85C \uAE30\uC6B8\uC9C0 \uC54A\uAC8C \uD574\uC694.',
    ],
  },
  {
    title: '\uC67C\uCABD \uC606\uAD6C\uB9AC \uAD7D\uD788\uAE30',
    goal: '\uC190\uC744 \uC704\uB85C \uC62C\uB9B0 \uCC44 \uC67C\uCABD\uC73C\uB85C \uCC9C\uCC9C\uD788 \uAE30\uC6B8\uC5EC\uC694.',
    tips: [
      '\uD314\uC744 \uD3B4\uACE0 \uC606\uAD6C\uB9AC\uAC00 \uB298\uC5B4\uB098\uAC8C \uD574\uC694.',
      '\uACE8\uBC18\uC774 \uB108\uBB34 \uBC00\uB9AC\uC9C0 \uC54A\uAC8C \uC720\uC9C0\uD574\uC694.',
      '\uBB34\uB9AC\uD558\uC9C0 \uC54A\uACE0 \uC720\uC9C0\uD574\uC694.',
    ],
  },
  {
    title: '\uC624\uB978\uCABD \uC606\uAD6C\uB9AC \uAD7D\uD788\uAE30',
    goal: '\uC190\uC744 \uC704\uB85C \uC62C\uB9B0 \uCC44 \uC624\uB978\uCABD\uC73C\uB85C \uCC9C\uCC9C\uD788 \uAE30\uC6B8\uC5EC\uC694.',
    tips: [
      '\uD314\uC744 \uD3B4\uACE0 \uC606\uAD6C\uB9AC\uAC00 \uB298\uC5B4\uB098\uAC8C \uD574\uC694.',
      '\uACE8\uBC18\uC774 \uB108\uBB34 \uBC00\uB9AC\uC9C0 \uC54A\uAC8C \uC720\uC9C0\uD574\uC694.',
      '\uBB34\uB9AC\uD558\uC9C0 \uC54A\uACE0 \uC720\uC9C0\uD574\uC694.',
    ],
  },
  {
    title: '\uC190 \uAE4D\uC9C0 \uB07C\uACE0 \uC544\uB798\uB85C \uC219\uC774\uAE30',
    goal: '\uBB34\uB98E\uC744 \uD3B4\uACE0 \uC0C1\uCCB4\uB97C \uC55E\uC73C\uB85C \uC219\uC5EC\uC694.',
    tips: [
      '\uBB34\uB98E\uC774 \uAD7D\uD600\uC9C0\uC9C0 \uC54A\uAC8C \uD574\uC694.',
      '\uC190\uC740 \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uC544\uB798\uB85C \uB0B4\uB824\uC694.',
      '\uCC9C\uCC9C\uD788 \uC219\uC774\uACE0 \uC790\uC138\uB97C \uC720\uC9C0\uD574\uC694.',
    ],
  },
]

const TOP_AI_MOTIONS: GymnasticsMotion[] = [
  {
    title: '제자리 걷기',
    goal: '왼쪽 무릎과 오른쪽 무릎을 번갈아 들어요.',
    tips: ['무릎을 조금 더 높이 들어요', '상체는 곧게 세워요', '제자리에서 움직여요'],
  },
  {
    title: '사이드 스텝',
    goal: '다리를 옆으로 크게 벌렸다가 다시 모아요.',
    tips: ['발까지 보이게 서요', '옆으로 크게 벌려요', '다시 중앙으로 돌아와요'],
  },
  {
    title: '대각선 몸통 지르기',
    goal: '몸통 높이로 양팔을 번갈아 앞으로 뻗어요.',
    tips: ['팔을 앞으로 뻗어요', '반대쪽 팔도 번갈아 해요', '몸은 정면을 봐요'],
  },
  {
    title: '대각선 얼굴 지르기',
    goal: '얼굴 높이로 양팔을 번갈아 앞으로 뻗어요.',
    tips: ['주먹을 더 높게 올려요', '팔을 앞으로 뻗어요', '좌우를 번갈아 해요'],
  },
  {
    title: '스쿼트',
    goal: '무릎을 굽혀 앉았다가 천천히 일어나요.',
    tips: ['무릎까지 보이게 서요', '조금 더 깊이 앉아요', '천천히 일어나요'],
  },
]

const FLAT_COLORS = {
  surface: 0xfffbf2,
  surfaceAlt: 0xfff6e7,
  border: 0xe3c28d,
  accent: 0x7f4a24,
  text: '#2f2116',
  muted: '#7a5430',
  primary: 0x2f9e58,
  primaryDark: 0x237a42,
  secondary: 0xfff6e7,
}
const TARGET_POSE_FRAME_SCALE = 1
const HEADER_FRAME_TEXTURE_KEY = 'gymnastics-header-frame-cropped'
const HEADER_FRAME_CROP = { x: 38, y: 165, width: 1924, height: 315 }
const HEADER_FRAME_CAP_WIDTH = 260
const SIDE_FRAME_ASPECT = 1448 / 1086
const GUIDE_FRAME_CAP_WIDTH = 260
const FEEDBACK_FRAME_CAP_WIDTH = 360
const SIDE_FRAME_VISIBLE_SCALE = 0.96
const GUIDE_TITLE_Y_RATIO = 0.082
const FEEDBACK_TITLE_Y_RATIO = 0.086
const FEEDBACK_MAIN_Y_RATIO = 0.47
const FEEDBACK_TIP_Y_RATIO = 0.66
const FRAME_TEXT_COLOR = '#5a2f12'
const FRAME_TEXT_STROKE = '#fff0c8'
const FRAME_TEXT_SHADOW = '#2f1708'

function createInitialAiState(): GymnasticsAiState {
  return {
    previousState: 'idle',
    stepCount: 0,
    holdDurationMs: 0,
    holdCompleted: false,
    holdLastTimestampMs: null,
    lastCountedSide: null,
    lastSeenSide: null,
    leftArmed: true,
    rightArmed: true,
    referenceHipX: null,
    referenceHipY: null,
    referenceScale: null,
    displayedFeedbackCode: null,
    displayedFeedbackText: null,
    displayedFeedbackFrames: 0,
    candidateFeedbackCode: null,
    candidateFeedbackText: null,
    candidateFeedbackStreak: 0,
    representativeFeedbackTotals: {},
    representativeFeedbackCode: null,
    representativeFeedbackText: null,
    representativeFeedbackFrames: 0,
    baselineLeftStepExtent: null,
    baselineRightStepExtent: null,
    baselineAnkleSpan: null,
    baselineLeftWristForward: null,
    baselineRightWristForward: null,
    baselineStanceSpan: null,
    baselineLeftKneeY: null,
    baselineRightKneeY: null,
    baselineLeftWristZ: null,
    baselineRightWristZ: null,
    accuracy: 0,
    tracking: 'idle',
    feedback: null,
    localPhase: 'ready',
    lastLocalRepAtMs: 0,
  }
}

class GymnasticsPlaySceneBase extends Phaser.Scene {
  private motionIndex = 0
  private remainingSeconds = 72
  private poseTracker: PoseTracker | null = null
  private cameraCanvas!: HTMLCanvasElement
  private cameraContext!: CanvasRenderingContext2D
  private cameraTexture!: Phaser.Textures.CanvasTexture
  private cameraBounds!: PanelBounds
  private statusBadgeBounds!: PanelBounds
  private statusDot!: Phaser.GameObjects.Arc
  private statusText!: Phaser.GameObjects.Text
  private motionCounterText!: Phaser.GameObjects.Text
  private motionTitleText!: Phaser.GameObjects.Text
  private timerText!: Phaser.GameObjects.Text
  private feedbackTitleText!: Phaser.GameObjects.Text
  private feedbackStarImage!: Phaser.GameObjects.Image
  private feedbackTipTexts: Phaser.GameObjects.Text[] = []
  private feedbackFrameBounds!: PanelBounds
  private timerEvent?: Phaser.Time.TimerEvent
  private isCameraRecognized = false
  private motionCounterMaxWidth = 0
  private motionTitleMaxWidth = 0
  private timerMaxWidth = 0
  private headerFontSize = 0
  private feedbackTitleMaxWidth = 0
  private requestInFlight = false
  private aiRequestsEnabled = true
  private isMotionAdvancing = false
  private aiState = createInitialAiState()
  private aiError: string | null = null
  private sessionStartedAtMs = 0
  private motionStartedAtMs = 0
  private motionResults: LocalExerciseMotionResult[] = []
  private hasSubmittedSession = false
  private savedSession: ExerciseSessionDetail | null = null
  private saveState: 'idle' | 'saving' | 'success' | 'error' = 'idle'
  private saveRetryButton?: Phaser.GameObjects.Text

  constructor(
    sceneKey: string,
    private readonly motions: GymnasticsMotion[],
    private readonly modeLabel: string,
    private readonly exerciseType: string,
    private readonly aiSequence: AiMotionSpec[],
  ) {
    super({ key: sceneKey })
  }

  preload() {
    this.load.image(
      GYMNASTICS_PLAY_BACKGROUND_TEXTURE_KEY,
      assetPath('images/themes/gymnastics/background/gymbackground.png'),
    )
    this.load.image(
      'gymnastics-raccoon',
      assetPath('images/themes/gymnastics/characters/Raccoon.png'),
    )
    this.load.image(
      'gymnastics-pose-frame',
      assetPath('images/themes/gymnastics/ui/GuideframeUI.png'),
    )
    this.load.image(
      'gymnastics-feedback-frame',
      assetPath('images/themes/gymnastics/ui/feedfackframeUI.png'),
    )
    this.load.image('gymnastics-feedback-star', assetPath('images/themes/gymnastics/ui/star.png'))
    this.load.image('gymnastics-header-frame', assetPath('images/themes/gymnastics/ui/FrameUI.png'))
    this.load.image(
      'gymnastics-delete-button',
      assetPath('images/themes/gymnastics/ui/delete_btn.png'),
    )
  }

  create() {
    const { width: vw, height: vh } = this.scale
    this.motionIndex = 0
    this.remainingSeconds = 72
    this.isCameraRecognized = false
    this.aiState = createInitialAiState()
    this.aiError = null
    this.requestInFlight = false
    this.aiRequestsEnabled = true
    this.isMotionAdvancing = false
    this.sessionStartedAtMs = Date.now()
    this.motionStartedAtMs = this.sessionStartedAtMs
    this.motionResults = []
    this.hasSubmittedSession = false
    this.savedSession = null
    this.saveState = 'idle'

    addCoverBackground(this, GYMNASTICS_PLAY_BACKGROUND_TEXTURE_KEY).setDepth(0)
    this.add.rectangle(vw / 2, vh / 2, vw, vh, 0x2d1b10, 0.16).setDepth(1)

    this.createCameraTexture()
    this.createHeaderFrameTexture()
    this.createLayout(vw, vh)
    this.renderMotion()
    this.startPoseTracker()

    this.timerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        this.remainingSeconds = Math.max(0, this.remainingSeconds - 1)
        this.timerText.setText(this.formatTime(this.remainingSeconds))
        this.fitTextToWidth(this.timerText, this.timerMaxWidth, this.headerFontSize, 14)
      },
    })

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup())
    this.cameras.main.fadeIn(220, 0, 0, 0)
  }

  update() {
    this.drawCameraFrame()
    this.evaluateCurrentPose()
  }

  private createCameraTexture() {
    this.cameraCanvas = document.createElement('canvas')
    this.cameraCanvas.width = 960
    this.cameraCanvas.height = 720
    const context = this.cameraCanvas.getContext('2d')
    if (!context) {
      throw new Error('Camera canvas context is not available.')
    }
    this.cameraContext = context

    const textureKey = `${this.scene.key}-camera`
    if (this.textures.exists(textureKey)) {
      this.textures.remove(textureKey)
    }
    const texture = this.textures.addCanvas(textureKey, this.cameraCanvas)
    if (!texture) {
      throw new Error('Camera texture is not available.')
    }
    this.cameraTexture = texture
  }

  private createHeaderFrameTexture() {
    if (this.textures.exists(HEADER_FRAME_TEXTURE_KEY)) return

    const source = this.textures.get('gymnastics-header-frame').getSourceImage() as HTMLImageElement
    const canvas = document.createElement('canvas')
    canvas.width = HEADER_FRAME_CROP.width
    canvas.height = HEADER_FRAME_CROP.height
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Header frame canvas context is not available.')
    }

    context.drawImage(
      source,
      HEADER_FRAME_CROP.x,
      HEADER_FRAME_CROP.y,
      HEADER_FRAME_CROP.width,
      HEADER_FRAME_CROP.height,
      0,
      0,
      HEADER_FRAME_CROP.width,
      HEADER_FRAME_CROP.height,
    )
    this.textures.addCanvas(HEADER_FRAME_TEXTURE_KEY, canvas)
  }

  private createLayout(vw: number, vh: number) {
    const margin = Phaser.Math.Clamp(Math.min(vw, vh) * 0.032, 12, 18)
    const headerH = Phaser.Math.Clamp(vh * 0.085, 32, 44)
    const sideW = Phaser.Math.Clamp(vw * 0.32, 240, 360)
    const gap = Phaser.Math.Clamp(vw * 0.014, 8, 12)
    const contentTop = margin + headerH + gap
    const availableH = vh - contentTop - margin
    const maxGroupW = vw - margin * 2
    const maxCameraW = maxGroupW - sideW - gap
    const sidePanelGap = Math.max(12, availableH * 0.04)
    const sidePanelH = Math.min((availableH - sidePanelGap) / 2, sideW / SIDE_FRAME_ASPECT)
    const contentH = sidePanelH * 2 + sidePanelGap
    const cameraH = contentH
    const cameraW = Math.min(maxCameraW * 0.74, cameraH * SIDE_FRAME_ASPECT)
    const groupW = cameraW + gap + sideW
    const groupX = (vw - groupW) / 2
    const contentY = contentTop + Math.max(0, (availableH - contentH) / 2)
    const sideX = groupX + cameraW + gap
    const sideHeaderInset = Math.max(12, sideW * 0.04)
    const sideHeaderW = sideW - sideHeaderInset * 2
    const sideHeaderX = sideX + sideHeaderInset
    const headerTop = Math.max(margin, contentY - gap - headerH)

    this.cameraBounds = {
      x: groupX,
      y: contentY,
      width: cameraW,
      height: cameraH,
    }

    this.createHeader(headerTop, headerH, groupX, cameraW, sideHeaderX, sideHeaderW)
    this.createCameraPanel(this.cameraBounds)
    this.createSidePanels(sideX, contentY, sideW, contentH)
  }

  private createHeader(
    headerTop: number,
    headerH: number,
    headerX: number,
    headerW: number,
    rightHeaderX: number,
    rightHeaderW: number,
  ) {
    const y = headerTop + headerH / 2
    const headerGap = Math.max(8, headerH * 0.28)
    const timerLikeW = Phaser.Math.Clamp(headerW * 0.18, 96, 132)
    const modePanelW = headerH + headerGap + timerLikeW
    const motionPanelW = headerW - modePanelW - headerGap
    const motionPanelX = headerX + modePanelW + headerGap
    const headerFontSize = Math.round(headerH * 0.38)
    const headerTextStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'sans-serif',
      fontSize: `${headerFontSize}px`,
      color: FRAME_TEXT_COLOR,
      fontStyle: 'bold',
      align: 'center',
      stroke: FRAME_TEXT_STROKE,
      strokeThickness: 3,
      shadow: {
        offsetX: 0,
        offsetY: 1,
        color: FRAME_TEXT_SHADOW,
        blur: 1,
        fill: true,
      },
    }

    this.createHeaderFrame(headerX, headerTop, modePanelW, headerH)
    this.createHeaderFrame(motionPanelX, headerTop, motionPanelW, headerH)

    const headerTextInset = Math.max(18, headerH * 0.9)
    const modeTextCenterX = headerX + headerTextInset + (modePanelW - headerTextInset * 2) / 2
    this.motionCounterMaxWidth = modePanelW - headerTextInset * 2
    this.motionTitleMaxWidth = motionPanelW - headerH * 2.4
    this.timerMaxWidth = Math.max(64, rightHeaderW - headerH - headerGap - 28)
    this.headerFontSize = headerFontSize

    this.motionCounterText = this.add
      .text(modeTextCenterX, y, this.modeLabel, headerTextStyle)
      .setOrigin(0.5)
      .setDepth(12)

    this.motionTitleText = this.add
      .text(motionPanelX + motionPanelW / 2, y, '', headerTextStyle)
      .setOrigin(0.5)
      .setDepth(12)

    this.createArrowButton(motionPanelX + headerH * 0.54, y, headerH * 0.86, '<', () =>
      this.returnToPreviousMotion(),
    )
    this.createArrowButton(
      motionPanelX + motionPanelW - headerH * 0.54,
      y,
      headerH * 0.86,
      '>',
      () => this.advanceToNextMotion(true),
    )

    const timerPanelX = rightHeaderX
    const timerPanelW = Math.max(0, rightHeaderW - headerH - headerGap)
    this.createHeaderFrame(timerPanelX, headerTop, timerPanelW, headerH)
    this.timerText = this.add
      .text(
        timerPanelX + timerPanelW / 2,
        y,
        this.formatTime(this.remainingSeconds),
        headerTextStyle,
      )
      .setOrigin(0.5)
      .setDepth(12)

    this.createDeleteButton(rightHeaderX + rightHeaderW - headerH / 2, y, headerH, () =>
      fadeToScene(this, 'GymnasticsSelectScene'),
    )
  }

  private createCameraPanel(bounds: PanelBounds) {
    this.createPanel(bounds.x, bounds.y, bounds.width, bounds.height, 16)
    const cameraInset = 8
    const cameraRadius = 12
    const cameraImage = this.add
      .image(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, this.cameraTexture.key)
      .setDisplaySize(bounds.width - cameraInset * 2, bounds.height - cameraInset * 2)
      .setDepth(5)

    const cameraMaskShape = this.add.graphics()
    cameraMaskShape
      .fillStyle(0xffffff, 1)
      .fillRoundedRect(
        bounds.x + cameraInset,
        bounds.y + cameraInset,
        bounds.width - cameraInset * 2,
        bounds.height - cameraInset * 2,
        cameraRadius,
      )
      .setVisible(false)
    cameraImage.setMask(cameraMaskShape.createGeometryMask())

    const badgeW = 94
    const badgeH = 28
    const badgeX = bounds.x + 18
    const badgeY = bounds.y + 18
    this.statusBadgeBounds = { x: badgeX, y: badgeY, width: badgeW, height: badgeH }
    const badge = this.add.graphics().setDepth(9)
    badge.fillStyle(0x3f220c, 0.14)
    badge.fillRoundedRect(badgeX, badgeY + 2, badgeW, badgeH, 12)
    badge.fillStyle(FLAT_COLORS.surface, 0.98)
    badge.fillRoundedRect(badgeX, badgeY, badgeW, badgeH, 12)
    badge.lineStyle(1, FLAT_COLORS.border, 1)
    badge.strokeRoundedRect(badgeX, badgeY, badgeW, badgeH, 12)
    this.statusDot = this.add.circle(0, badgeY + badgeH / 2, 5.5, 0xd13b2f).setDepth(10)
    this.statusText = this.add
      .text(badgeX + 28, badgeY + badgeH / 2, '인식 불가', {
        fontFamily: 'sans-serif',
        fontSize: '13px',
        color: FLAT_COLORS.text,
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5)
      .setDepth(10)
    this.layoutStatusBadge()
  }

  private layoutStatusBadge() {
    const dotRadius = this.statusDot.radius
    const gap = 8
    const groupW = dotRadius * 2 + gap + this.statusText.width
    const startX = this.statusBadgeBounds.x + (this.statusBadgeBounds.width - groupW) / 2
    const centerY = this.statusBadgeBounds.y + this.statusBadgeBounds.height / 2

    this.statusDot.setPosition(startX + dotRadius, centerY)
    this.statusText.setPosition(startX + dotRadius * 2 + gap, centerY)
  }

  private createSidePanels(x: number, y: number, width: number, height: number) {
    const panelGap = Math.max(12, height * 0.04)
    const panelH = (height - panelGap) / 2
    const targetH = panelH
    const feedbackY = y + panelH + panelGap
    const feedbackH = panelH
    const frameW = width * SIDE_FRAME_VISIBLE_SCALE
    const targetFrameH = targetH * SIDE_FRAME_VISIBLE_SCALE
    const feedbackFrameH = feedbackH * SIDE_FRAME_VISIBLE_SCALE
    const frameLeft = x + (width - frameW) / 2
    const targetFrameTop = y + (targetH - targetFrameH) / 2
    const feedbackFrameTop = feedbackY + (feedbackH - feedbackFrameH) / 2
    const sectionTitleX = x + width / 2
    const targetTitleY = targetFrameTop + targetFrameH * GUIDE_TITLE_Y_RATIO
    const feedbackTitleY = feedbackFrameTop + feedbackFrameH * FEEDBACK_TITLE_Y_RATIO
    this.feedbackFrameBounds = {
      x: frameLeft,
      y: feedbackFrameTop,
      width: frameW,
      height: feedbackFrameH,
    }

    this.add
      .image(
        x + width / 2,
        y + targetH / 2,
        this.createHorizontalSlicedFrameTexture(
          'gymnastics-pose-frame',
          frameW * TARGET_POSE_FRAME_SCALE,
          targetFrameH * TARGET_POSE_FRAME_SCALE,
          GUIDE_FRAME_CAP_WIDTH,
        ),
      )
      .setDepth(11)
    this.add
      .text(sectionTitleX, targetTitleY, '가이드 영상', {
        fontFamily: 'sans-serif',
        fontSize: `${Math.round(Phaser.Math.Clamp(targetFrameH * 0.07, 15, 18))}px`,
        color: FRAME_TEXT_COLOR,
        fontStyle: 'bold',
        stroke: FRAME_TEXT_STROKE,
        strokeThickness: 3,
        shadow: {
          offsetX: 0,
          offsetY: 1,
          color: FRAME_TEXT_SHADOW,
          blur: 1,
          fill: true,
        },
      })
      .setOrigin(0.5)
      .setDepth(13)

    this.add
      .image(
        x + width / 2,
        feedbackY + feedbackH / 2,
        this.createHorizontalSlicedFrameTexture(
          'gymnastics-feedback-frame',
          frameW,
          feedbackFrameH,
          FEEDBACK_FRAME_CAP_WIDTH,
        ),
      )
      .setDepth(11)
    this.add
      .text(sectionTitleX, feedbackTitleY, '실시간 피드백', {
        fontFamily: 'sans-serif',
        fontSize: `${Math.round(Phaser.Math.Clamp(feedbackFrameH * 0.07, 15, 18))}px`,
        color: FRAME_TEXT_COLOR,
        fontStyle: 'bold',
        stroke: FRAME_TEXT_STROKE,
        strokeThickness: 3,
        shadow: {
          offsetX: 0,
          offsetY: 1,
          color: FRAME_TEXT_SHADOW,
          blur: 1,
          fill: true,
        },
      })
      .setOrigin(0.5)
      .setDepth(13)

    const feedbackTitleFontSize = Math.round(Phaser.Math.Clamp(feedbackFrameH * 0.15, 24, 32))
    this.feedbackTitleText = this.add
      .text(
        this.feedbackFrameBounds.x + this.feedbackFrameBounds.width / 2,
        feedbackFrameTop + feedbackFrameH * FEEDBACK_MAIN_Y_RATIO,
        '',
        {
          fontFamily: 'sans-serif',
          fontSize: `${feedbackTitleFontSize}px`,
          color: '#3b2412',
          fontStyle: 'bold',
          stroke: '#fff1d0',
          strokeThickness: 2,
          align: 'center',
        },
      )
      .setOrigin(0.5)
      .setDepth(13)
    this.feedbackTitleMaxWidth = frameW * 0.72

    this.feedbackStarImage = this.add
      .image(
        this.feedbackFrameBounds.x + this.feedbackFrameBounds.width * 0.18,
        this.feedbackTitleText.y,
        'gymnastics-feedback-star',
      )
      .setOrigin(0.5)
      .setDepth(13)

    this.feedbackTipTexts = [
      this.add
        .text(x + width / 2, feedbackFrameTop + feedbackFrameH * FEEDBACK_TIP_Y_RATIO, '', {
          fontFamily: 'sans-serif',
          fontSize: `${Math.round(Phaser.Math.Clamp(feedbackH * 0.08, 15, 22))}px`,
          color: '#b94122',
          fontStyle: 'bold',
          align: 'center',
          stroke: '#fff1d0',
          strokeThickness: 1,
          wordWrap: { width: frameW * 0.78, useAdvancedWrap: true },
        })
        .setOrigin(0.5)
        .setDepth(13),
    ]

    this.saveRetryButton = this.add
      .text(x + width / 2, feedbackFrameTop + feedbackFrameH * 0.82, '다시 저장하기', {
        fontFamily: 'sans-serif',
        fontSize: `${Math.round(Phaser.Math.Clamp(feedbackH * 0.07, 14, 19))}px`,
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
        backgroundColor: '#2f9e58',
        padding: { x: 18, y: 8 },
      })
      .setOrigin(0.5)
      .setDepth(14)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })

    this.saveRetryButton.on('pointerup', () => {
      if (this.saveState !== 'error') return
      void this.finishExerciseSession()
    })
  }

  private createPanel(x: number, y: number, width: number, height: number, radius: number) {
    const graphics = this.add.graphics().setDepth(4)
    graphics.fillStyle(0x4b250c, 0.26)
    graphics.fillRoundedRect(x, y + 7, width, height, radius)
    graphics.fillStyle(0xf3d59a, 0.98)
    graphics.fillRoundedRect(x, y, width, height, radius)
    graphics.lineStyle(4, 0x7a471c, 1)
    graphics.strokeRoundedRect(x, y, width, height, radius)
    graphics.lineStyle(2, 0xffefbd, 0.86)
    graphics.strokeRoundedRect(x + 4, y + 4, width - 8, height - 8, Math.max(4, radius - 4))
    graphics.lineStyle(2, 0x3f210c, 0.48)
    graphics.strokeRoundedRect(x + 8, y + 8, width - 16, height - 16, Math.max(4, radius - 8))
    return graphics
  }

  private createHeaderFrame(x: number, y: number, width: number, height: number) {
    const textureKey = this.createSizedHeaderFrameTexture(width, height)
    return this.add.image(x + width / 2, y + height / 2, textureKey).setDepth(10)
  }

  private createSizedHeaderFrameTexture(width: number, height: number) {
    const targetW = Math.max(1, Math.round(width))
    const targetH = Math.max(1, Math.round(height))
    const textureKey = `${HEADER_FRAME_TEXTURE_KEY}-${targetW}x${targetH}`
    if (this.textures.exists(textureKey)) return textureKey

    const source = this.textures.get(HEADER_FRAME_TEXTURE_KEY).getSourceImage() as HTMLCanvasElement
    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Sized header frame canvas context is not available.')
    }

    const sourceW = source.width
    const sourceH = source.height
    const capSrcW = Math.min(HEADER_FRAME_CAP_WIDTH, sourceW / 2)
    const dstCapW = Math.min(targetW / 2, capSrcW * (targetH / sourceH))
    const centerSrcW = sourceW - capSrcW * 2
    const centerDstW = Math.max(0, targetW - dstCapW * 2)

    context.drawImage(source, 0, 0, capSrcW, sourceH, 0, 0, dstCapW, targetH)
    if (centerDstW > 0) {
      context.drawImage(source, capSrcW, 0, centerSrcW, sourceH, dstCapW, 0, centerDstW, targetH)
    }
    context.drawImage(
      source,
      sourceW - capSrcW,
      0,
      capSrcW,
      sourceH,
      targetW - dstCapW,
      0,
      dstCapW,
      targetH,
    )

    this.textures.addCanvas(textureKey, canvas)
    return textureKey
  }

  private createCroppedFrameTexture(sourceKey: string) {
    const textureKey = `${sourceKey}-visible-crop`
    if (this.textures.exists(textureKey)) return textureKey

    const source = this.textures.get(sourceKey).getSourceImage() as
      | HTMLCanvasElement
      | HTMLImageElement
    const visibleBounds = this.getTextureVisibleBounds(source)
    const canvas = document.createElement('canvas')
    canvas.width = visibleBounds.width
    canvas.height = visibleBounds.height
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Cropped frame canvas context is not available.')
    }
    context.drawImage(
      source,
      visibleBounds.x,
      visibleBounds.y,
      visibleBounds.width,
      visibleBounds.height,
      0,
      0,
      visibleBounds.width,
      visibleBounds.height,
    )

    this.textures.addCanvas(textureKey, canvas)
    return textureKey
  }

  private createHorizontalSlicedFrameTexture(
    sourceKey: string,
    width: number,
    height: number,
    capWidth: number,
  ) {
    const targetW = Math.max(1, Math.round(width))
    const targetH = Math.max(1, Math.round(height))
    const textureKey = `${sourceKey}-h-slice-${targetW}x${targetH}-${capWidth}`
    if (this.textures.exists(textureKey)) return textureKey

    const croppedKey = this.createCroppedFrameTexture(sourceKey)
    const source = this.textures.get(croppedKey).getSourceImage() as HTMLCanvasElement
    const sourceW = source.width
    const sourceH = source.height
    const capSrcW = Math.min(capWidth, sourceW / 2)
    const dstCapW = Math.min(targetW / 2, capSrcW * (targetH / sourceH))
    const centerSrcW = Math.max(1, sourceW - capSrcW * 2)
    const centerDstW = Math.max(0, targetW - dstCapW * 2)

    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Horizontal sliced frame canvas context is not available.')
    }

    context.drawImage(source, 0, 0, capSrcW, sourceH, 0, 0, dstCapW, targetH)
    if (centerDstW > 0) {
      context.drawImage(source, capSrcW, 0, centerSrcW, sourceH, dstCapW, 0, centerDstW, targetH)
    }
    context.drawImage(
      source,
      sourceW - capSrcW,
      0,
      capSrcW,
      sourceH,
      targetW - dstCapW,
      0,
      dstCapW,
      targetH,
    )

    this.textures.addCanvas(textureKey, canvas)
    return textureKey
  }

  private getTextureVisibleBounds(source: HTMLCanvasElement | HTMLImageElement) {
    const canvas = document.createElement('canvas')
    canvas.width = source.width
    canvas.height = source.height
    const context = canvas.getContext('2d')
    if (!context) {
      return { x: 0, y: 0, width: source.width, height: source.height }
    }

    context.drawImage(source, 0, 0)
    const pixels = context.getImageData(0, 0, source.width, source.height).data
    let minX = source.width
    let minY = source.height
    let maxX = -1
    let maxY = -1

    for (let y = 0; y < source.height; y += 1) {
      for (let x = 0; x < source.width; x += 1) {
        const alpha = pixels[(y * source.width + x) * 4 + 3]
        if (alpha <= 8) continue
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }

    if (maxX < minX || maxY < minY) {
      return { x: 0, y: 0, width: source.width, height: source.height }
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    }
  }

  private createDeleteButton(x: number, y: number, size: number, onClick: () => void) {
    const bg = this.add
      .image(0, 0, 'gymnastics-delete-button')
      .setDisplaySize(size, size)
      .setDepth(14)
    const hitArea = this.add.rectangle(0, 0, size, size, 0xffffff, 0).setInteractive({
      useHandCursor: true,
    })
    hitArea.on('pointerdown', onClick)

    return this.add.container(x, y, [bg, hitArea]).setDepth(14)
  }

  private createArrowButton(
    x: number,
    y: number,
    size: number,
    label: string,
    onClick: () => void,
  ) {
    const container = this.add.container(x, y).setDepth(14)
    const width = size
    const height = size
    const direction = label === '<' ? -1 : 1
    const arrow = this.add.graphics()
    const arrowW = size * 0.36
    const arrowH = size * 0.28
    const bevel = size * 0.08
    const tipX = direction * arrowW * 0.46
    const backX = -direction * arrowW * 0.38

    const drawWoodArrow = (offsetX: number, offsetY: number, fill: number, alpha = 1) => {
      arrow.fillStyle(fill, alpha)
      arrow.beginPath()
      arrow.moveTo(backX + offsetX, -arrowH * 0.5 + offsetY)
      arrow.lineTo(tipX + offsetX, offsetY)
      arrow.lineTo(backX + offsetX, arrowH * 0.5 + offsetY)
      arrow.lineTo(backX - direction * bevel + offsetX, arrowH * 0.32 + offsetY)
      arrow.lineTo(backX - direction * bevel + offsetX, -arrowH * 0.32 + offsetY)
      arrow.closePath()
      arrow.fillPath()
    }

    drawWoodArrow(0, 2, 0x5b2f14, 0.22)
    drawWoodArrow(0, 0, 0xa86d38)
    arrow.lineStyle(2, 0xd6a56d, 0.55)
    arrow.beginPath()
    arrow.moveTo(backX - direction * bevel * 0.6, -arrowH * 0.28)
    arrow.lineTo(backX + direction * arrowW * 0.12, -arrowH * 0.16)
    arrow.strokePath()

    const hitArea = this.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({
      useHandCursor: true,
    })
    hitArea.on('pointerdown', onClick)

    container.add([arrow, hitArea])
    return container
  }

  private async startPoseTracker() {
    try {
      const tracker = new PoseTracker({
        delegate: 'CPU',
        video: {
          facingMode: 'user',
          width: { ideal: 960 },
          height: { ideal: 720 },
        },
      })
      await tracker.start()
      this.poseTracker = tracker
    } catch (error) {
      this.poseTracker = null
      this.aiError = error instanceof Error ? error.message : 'Camera start failed'
      this.updateRecognitionStatus(false)
    }
  }

  private canReadCameraFrame() {
    return Boolean(
      this.poseTracker?.video &&
      this.poseTracker.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA,
    )
  }

  private drawCameraFrame() {
    this.cameraContext.clearRect(0, 0, this.cameraCanvas.width, this.cameraCanvas.height)

    if (this.canReadCameraFrame() && this.poseTracker?.video) {
      this.cameraContext.save()
      this.cameraContext.translate(this.cameraCanvas.width, 0)
      this.cameraContext.scale(-1, 1)
      this.cameraContext.drawImage(
        this.poseTracker.video,
        0,
        0,
        this.cameraCanvas.width,
        this.cameraCanvas.height,
      )
      this.cameraContext.restore()
    } else {
      const gradient = this.cameraContext.createLinearGradient(0, 0, 0, this.cameraCanvas.height)
      gradient.addColorStop(0, '#f6c067')
      gradient.addColorStop(1, '#91511d')
      this.cameraContext.fillStyle = gradient
      this.cameraContext.fillRect(0, 0, this.cameraCanvas.width, this.cameraCanvas.height)
      this.cameraContext.fillStyle = 'rgba(61, 34, 16, 0.75)'
      this.cameraContext.font = 'bold 42px sans-serif'
      this.cameraContext.textAlign = 'center'
      this.cameraContext.fillText(
        '카메라를 준비하고 있어요',
        this.cameraCanvas.width / 2,
        this.cameraCanvas.height / 2,
      )
    }

    this.cameraTexture.refresh()
  }

  private evaluateCurrentPose() {
    const tracker = this.poseTracker
    if (!tracker) {
      this.updateRecognitionStatus(false)
      return
    }

    if (this.isMotionAdvancing) return

    const detection = tracker.detect()
    const pose = detection.poses[0]
    if (!pose) {
      this.updateRecognitionStatus(this.canReadCameraFrame())
      return
    }

    this.updateRecognitionStatus(true)
    this.drawPoseLandmarks(pose.landmarks)
    this.evaluatePoseLocally(detection.timestampMs, pose.landmarks)

    if (this.requestInFlight || !this.aiRequestsEnabled) return

    this.requestInFlight = true
    void this.requestAiEvaluation(detection.timestampMs, pose.landmarks)
      .catch(error => {
        this.aiError = error instanceof Error ? error.message : 'AI request failed'
        this.aiRequestsEnabled = false
      })
      .finally(() => {
        this.requestInFlight = false
      })
  }

  private async requestAiEvaluation(
    timestampMs: number,
    landmarks: readonly { x: number; y: number; z: number; visibility?: number }[],
  ) {
    const motionSpec = this.getCurrentAiMotionSpec()
    const frame = {
      timestamp_ms: Math.floor(timestampMs),
      mirrored: true,
      landmarks: this.toLandmarkPayload(landmarks),
    }
    const sharedPayload = {
      frame,
      previous_state: this.aiState.previousState,
      reference_hip_x: this.aiState.referenceHipX,
      reference_hip_y: this.aiState.referenceHipY,
      reference_scale: this.aiState.referenceScale,
      displayed_feedback_code: this.aiState.displayedFeedbackCode,
      displayed_feedback_text: this.aiState.displayedFeedbackText,
      displayed_feedback_frames: this.aiState.displayedFeedbackFrames,
      candidate_feedback_code: this.aiState.candidateFeedbackCode,
      candidate_feedback_text: this.aiState.candidateFeedbackText,
      candidate_feedback_streak: this.aiState.candidateFeedbackStreak,
      representative_feedback_totals: this.aiState.representativeFeedbackTotals,
      representative_feedback_code: this.aiState.representativeFeedbackCode,
      representative_feedback_text: this.aiState.representativeFeedbackText,
      representative_feedback_frames: this.aiState.representativeFeedbackFrames,
    }
    const requestUrl =
      motionSpec.type === 'daniel'
        ? `${AI_BASE_URL}/gymnastics/daniel/evaluate`
        : `${AI_BASE_URL}/gymnastics/${MOTION_ENDPOINTS[motionSpec.kind]}/evaluate`
    const requestBody =
      motionSpec.type === 'daniel'
        ? {
            ...sharedPayload,
            motion_id: motionSpec.kind,
            target_hold_ms: motionSpec.targetHoldMs,
            hold_duration_ms: this.aiState.holdDurationMs,
            hold_last_timestamp_ms: this.aiState.holdLastTimestampMs,
            baseline_left_wrist_forward: this.aiState.baselineLeftWristForward,
            baseline_right_wrist_forward: this.aiState.baselineRightWristForward,
          }
        : {
            ...sharedPayload,
            step_count: this.aiState.stepCount,
            target_steps: motionSpec.targetSteps,
            last_counted_side: this.aiState.lastCountedSide,
            last_seen_side: this.aiState.lastSeenSide,
            left_armed: this.aiState.leftArmed,
            right_armed: this.aiState.rightArmed,
            baseline_left_step_extent: this.aiState.baselineLeftStepExtent,
            baseline_right_step_extent: this.aiState.baselineRightStepExtent,
            baseline_ankle_span: this.aiState.baselineAnkleSpan,
            baseline_left_wrist_forward: this.aiState.baselineLeftWristForward,
            baseline_right_wrist_forward: this.aiState.baselineRightWristForward,
            baseline_stance_span: this.aiState.baselineStanceSpan,
          }
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      this.aiError = `AI response error: ${response.status}`
      this.applyAiFeedback()
      return
    }

    this.updateAiState((await response.json()) as GymnasticsAiResponse)
    this.aiError = null
    this.applyAiFeedback()
    this.advanceMotionIfCompleted()
  }

  private evaluatePoseLocally(
    timestampMs: number,
    landmarks: readonly { x: number; y: number; z: number; visibility?: number }[],
  ) {
    const motionSpec = this.getCurrentAiMotionSpec()
    if (motionSpec.type === 'daniel') return

    const previousStepCount = this.aiState.stepCount
    const nextState = { ...this.aiState, tracking: 'tracked', feedback: '동작을 따라 해볼까요?' }

    if (!this.hasCoreBodyLandmarks(landmarks)) {
      nextState.feedback = '뒤로 가볼까요'
      nextState.tracking = 'tracking_low'
      this.aiState = nextState
      this.applyAiFeedback()
      return
    }

    if (motionSpec.kind === 'march') {
      this.evaluateLocalMarch(nextState, landmarks, timestampMs)
    } else if (motionSpec.kind === 'side-step') {
      this.evaluateLocalSideStep(nextState, landmarks, timestampMs)
    } else if (
      motionSpec.kind === 'diagonal-body-punch' ||
      motionSpec.kind === 'diagonal-face-punch'
    ) {
      this.evaluateLocalPunch(nextState, landmarks, timestampMs, motionSpec.kind)
    } else {
      this.evaluateLocalSquat(nextState, landmarks, timestampMs)
    }

    nextState.stepCount = Math.min(nextState.stepCount, motionSpec.targetSteps)
    nextState.accuracy = nextState.stepCount / motionSpec.targetSteps
    this.aiState = nextState

    if (this.aiState.stepCount !== previousStepCount || !this.aiError) {
      this.applyAiFeedback()
    }
    this.advanceMotionIfCompleted()
  }

  private evaluateLocalMarch(
    state: GymnasticsAiState,
    landmarks: readonly { x: number; y: number }[],
    timestampMs: number,
  ) {
    const leftLift = this.verticalLift(landmarks, 'LEFT_HIP', 'LEFT_KNEE')
    const rightLift = this.verticalLift(landmarks, 'RIGHT_HIP', 'RIGHT_KNEE')
    const leftKnee = this.getLandmark(landmarks, 'LEFT_KNEE')
    const rightKnee = this.getLandmark(landmarks, 'RIGHT_KNEE')
    if (!leftKnee && !rightKnee) {
      state.feedback = '무릎도 보여요'
      return
    }
    if (leftKnee && (state.baselineLeftKneeY == null || state.localPhase === 'ready')) {
      state.baselineLeftKneeY =
        state.baselineLeftKneeY == null ? leftKnee.y : Math.max(state.baselineLeftKneeY, leftKnee.y)
    }
    if (rightKnee && (state.baselineRightKneeY == null || state.localPhase === 'ready')) {
      state.baselineRightKneeY =
        state.baselineRightKneeY == null
          ? rightKnee.y
          : Math.max(state.baselineRightKneeY, rightKnee.y)
    }

    const leftBaselineLift =
      leftKnee && state.baselineLeftKneeY != null ? state.baselineLeftKneeY - leftKnee.y : 0
    const rightBaselineLift =
      rightKnee && state.baselineRightKneeY != null ? state.baselineRightKneeY - rightKnee.y : 0
    const leftScore = Math.max(leftLift, leftBaselineLift)
    const rightScore = Math.max(rightLift, rightBaselineLift)
    const side = leftScore > rightScore ? 'left' : 'right'
    const lift = Math.max(leftScore, rightScore)

    state.feedback = '번갈아 해요'

    if (lift > 0.045 && state.localPhase === 'ready' && state.lastCountedSide !== side) {
      this.countLocalRep(state, timestampMs, side, '참 잘했어요')
      state.localPhase = 'active'
      return
    }

    if (lift > 0.045 && state.lastCountedSide === side) {
      state.feedback = '반대쪽도 해요'
      return
    }

    if (lift > 0.025) {
      state.feedback = '조금 더 높이'
    }

    if (lift < 0.018) {
      state.localPhase = 'ready'
      state.feedback = '다음 다리 해요'
    }
  }

  private evaluateLocalSideStep(
    state: GymnasticsAiState,
    landmarks: readonly { x: number; y: number }[],
    timestampMs: number,
  ) {
    const ankleSpan = this.horizontalDistance(landmarks, 'LEFT_ANKLE', 'RIGHT_ANKLE')
    if (ankleSpan <= 0) {
      state.feedback = '발도 보여요'
      return
    }
    if (state.baselineAnkleSpan == null && ankleSpan > 0) {
      state.baselineAnkleSpan = ankleSpan
    } else if (state.localPhase === 'ready' && ankleSpan > 0 && state.baselineAnkleSpan != null) {
      state.baselineAnkleSpan = Math.min(state.baselineAnkleSpan, ankleSpan)
    }

    const baseline = Math.max(state.baselineAnkleSpan ?? ankleSpan, 0.12)
    const opened = ankleSpan > baseline * 1.18 && ankleSpan - baseline > 0.035

    state.feedback = '크게 해볼까요'

    if (opened && state.localPhase === 'ready') {
      this.countLocalRep(state, timestampMs, null, '참 잘했어요')
      state.localPhase = 'active'
      return
    }

    if (state.localPhase === 'active') {
      state.feedback = '다시 모아봐요'
    }

    if (ankleSpan < baseline * 1.08) {
      state.localPhase = 'ready'
      state.feedback = '다시 해볼까요'
    }
  }

  private evaluateLocalPunch(
    state: GymnasticsAiState,
    landmarks: readonly { x: number; y: number; z?: number }[],
    timestampMs: number,
    kind: GymnasticsMotionKind,
  ) {
    const leftReach = this.forwardReach(landmarks, 'LEFT_SHOULDER', 'LEFT_WRIST', -1)
    const rightReach = this.forwardReach(landmarks, 'RIGHT_SHOULDER', 'RIGHT_WRIST', 1)
    const leftDepthReach = this.depthReach(landmarks, 'LEFT_WRIST', state.baselineLeftWristZ)
    const rightDepthReach = this.depthReach(landmarks, 'RIGHT_WRIST', state.baselineRightWristZ)
    const leftScore = Math.max(leftReach, leftDepthReach)
    const rightScore = Math.max(rightReach, rightDepthReach)
    const side = leftScore > rightScore ? 'left' : 'right'
    const reach = Math.max(leftScore, rightScore)
    const wristHeightOk =
      kind === 'diagonal-body-punch' ||
      this.wristNearFaceHeight(landmarks, side === 'left' ? 'LEFT_WRIST' : 'RIGHT_WRIST')

    this.captureWristBaseline(state, landmarks)
    state.feedback = kind === 'diagonal-face-punch' ? '주먹 올려요' : '팔 뻗어봐요'

    if (!wristHeightOk) {
      state.feedback = '조금 더 높이'
      return
    }

    if (reach > 0.055 && state.localPhase === 'ready' && state.lastCountedSide !== side) {
      this.countLocalRep(state, timestampMs, side, '참 잘했어요')
      state.localPhase = 'active'
      return
    }

    if (reach > 0.055 && state.lastCountedSide === side) {
      state.feedback = '반대쪽도 해요'
      return
    }

    if (reach > 0.025) {
      state.feedback = '조금 더 뻗어요'
    }

    if (reach < 0.02) {
      state.localPhase = 'ready'
      state.feedback = '팔을 모아봐요'
    }
  }

  private evaluateLocalSquat(
    state: GymnasticsAiState,
    landmarks: readonly { x: number; y: number }[],
    timestampMs: number,
  ) {
    const hipY = this.midpointY(landmarks, 'LEFT_HIP', 'RIGHT_HIP')
    const hasKnees =
      this.getLandmark(landmarks, 'LEFT_KNEE') || this.getLandmark(landmarks, 'RIGHT_KNEE')
    if (!hasKnees) {
      state.feedback = '무릎도 보여요'
      return
    }
    if (state.referenceHipY == null) {
      state.referenceHipY = hipY
    }

    const hipDrop = hipY - state.referenceHipY
    state.feedback = '앉아볼까요'

    if (hipDrop > 0.08 && state.localPhase === 'ready') {
      state.localPhase = 'active'
      state.feedback = '일어나봐요'
      return
    }

    if (hipDrop > 0.04 && state.localPhase === 'ready') {
      state.feedback = '조금 더 앉아요'
      return
    }

    if (state.localPhase === 'active' && hipDrop < 0.035) {
      this.countLocalRep(state, timestampMs, null, '참 잘했어요')
      state.localPhase = 'ready'
    }
  }

  private countLocalRep(
    state: GymnasticsAiState,
    timestampMs: number,
    side: string | null,
    feedback: string,
  ) {
    if (timestampMs - state.lastLocalRepAtMs < 450) return
    state.stepCount += 1
    state.lastLocalRepAtMs = timestampMs
    state.lastCountedSide = side
    state.feedback = feedback
    state.previousState = 'counted'
  }

  private drawPoseLandmarks(landmarks: readonly { x: number; y: number; visibility?: number }[]) {
    this.cameraContext.save()
    this.cameraContext.fillStyle = '#5ce1e6'
    this.cameraContext.strokeStyle = 'rgba(255,255,255,0.7)'
    this.cameraContext.lineWidth = 2

    for (const landmark of landmarks) {
      if ((landmark.visibility ?? 1) < 0.05) continue
      this.cameraContext.beginPath()
      this.cameraContext.arc(
        (1 - landmark.x) * this.cameraCanvas.width,
        landmark.y * this.cameraCanvas.height,
        4,
        0,
        Math.PI * 2,
      )
      this.cameraContext.fill()
    }

    this.cameraContext.restore()
    this.cameraTexture.refresh()
  }

  private verticalLift(
    landmarks: readonly { x: number; y: number }[],
    hipName: (typeof POSE_LANDMARK_NAMES)[number],
    kneeName: (typeof POSE_LANDMARK_NAMES)[number],
  ) {
    const hip = this.getLandmark(landmarks, hipName)
    const knee = this.getLandmark(landmarks, kneeName)
    return hip && knee ? hip.y - knee.y : 0
  }

  private horizontalDistance(
    landmarks: readonly { x: number; y: number }[],
    leftName: (typeof POSE_LANDMARK_NAMES)[number],
    rightName: (typeof POSE_LANDMARK_NAMES)[number],
  ) {
    const left = this.getLandmark(landmarks, leftName)
    const right = this.getLandmark(landmarks, rightName)
    return left && right ? Math.abs(left.x - right.x) : 0
  }

  private forwardReach(
    landmarks: readonly { x: number; y: number }[],
    shoulderName: (typeof POSE_LANDMARK_NAMES)[number],
    wristName: (typeof POSE_LANDMARK_NAMES)[number],
    direction: -1 | 1,
  ) {
    const shoulder = this.getLandmark(landmarks, shoulderName)
    const wrist = this.getLandmark(landmarks, wristName)
    return shoulder && wrist ? (wrist.x - shoulder.x) * direction : 0
  }

  private captureWristBaseline(
    state: GymnasticsAiState,
    landmarks: readonly { x: number; y: number; z?: number }[],
  ) {
    const leftWrist = this.getLandmark(landmarks, 'LEFT_WRIST')
    const rightWrist = this.getLandmark(landmarks, 'RIGHT_WRIST')

    if (
      leftWrist?.z != null &&
      (state.baselineLeftWristZ == null || state.localPhase === 'ready')
    ) {
      state.baselineLeftWristZ =
        state.baselineLeftWristZ == null
          ? leftWrist.z
          : Math.max(state.baselineLeftWristZ, leftWrist.z)
    }
    if (
      rightWrist?.z != null &&
      (state.baselineRightWristZ == null || state.localPhase === 'ready')
    ) {
      state.baselineRightWristZ =
        state.baselineRightWristZ == null
          ? rightWrist.z
          : Math.max(state.baselineRightWristZ, rightWrist.z)
    }
  }

  private depthReach(
    landmarks: readonly { x: number; y: number; z?: number }[],
    wristName: (typeof POSE_LANDMARK_NAMES)[number],
    baselineZ: number | null,
  ) {
    const wrist = this.getLandmark(landmarks, wristName)
    if (wrist?.z == null || baselineZ == null) return 0
    return Math.max(0, baselineZ - wrist.z)
  }

  private wristNearFaceHeight(
    landmarks: readonly { x: number; y: number }[],
    wristName: (typeof POSE_LANDMARK_NAMES)[number],
  ) {
    const wrist = this.getLandmark(landmarks, wristName)
    const shoulderY = this.midpointY(landmarks, 'LEFT_SHOULDER', 'RIGHT_SHOULDER')
    return wrist ? wrist.y < shoulderY + 0.16 : false
  }

  private midpointY(
    landmarks: readonly { x: number; y: number }[],
    leftName: (typeof POSE_LANDMARK_NAMES)[number],
    rightName: (typeof POSE_LANDMARK_NAMES)[number],
  ) {
    const left = this.getLandmark(landmarks, leftName)
    const right = this.getLandmark(landmarks, rightName)
    if (!left && !right) return 0
    if (!left) return right!.y
    if (!right) return left.y
    return (left.y + right.y) / 2
  }

  private getLandmark(
    landmarks: readonly { x: number; y: number; z?: number; visibility?: number }[],
    name: (typeof POSE_LANDMARK_NAMES)[number],
  ) {
    return landmarks[POSE_LANDMARK_NAMES.indexOf(name)]
  }

  private hasCoreBodyLandmarks(
    landmarks: readonly { x: number; y: number; visibility?: number }[],
  ) {
    const requiredUpperBody: (typeof POSE_LANDMARK_NAMES)[number][] = [
      'LEFT_SHOULDER',
      'RIGHT_SHOULDER',
      'LEFT_HIP',
      'RIGHT_HIP',
    ]
    return requiredUpperBody.every(name => {
      const landmark = landmarks[POSE_LANDMARK_NAMES.indexOf(name)]
      return Boolean(landmark && (landmark.visibility ?? 1) >= 0.05)
    })
  }

  private updateAiState(payload: GymnasticsAiResponse) {
    this.aiState = {
      ...this.aiState,
      previousState: payload.state,
      stepCount: payload.step_count ?? (payload.hold_completed ? 1 : this.aiState.stepCount),
      holdDurationMs: payload.hold_duration_ms ?? this.aiState.holdDurationMs,
      holdCompleted: payload.hold_completed ?? this.aiState.holdCompleted,
      holdLastTimestampMs: payload.hold_last_timestamp_ms ?? null,
      lastCountedSide: payload.last_counted_side ?? null,
      lastSeenSide: payload.last_seen_side ?? null,
      leftArmed: payload.left_armed ?? this.aiState.leftArmed,
      rightArmed: payload.right_armed ?? this.aiState.rightArmed,
      referenceHipX: payload.reference_hip_x,
      referenceHipY: payload.reference_hip_y,
      referenceScale: payload.reference_scale,
      displayedFeedbackCode: payload.displayed_feedback_code,
      displayedFeedbackText: payload.displayed_feedback_text,
      displayedFeedbackFrames: payload.displayed_feedback_frames,
      candidateFeedbackCode: payload.candidate_feedback_code,
      candidateFeedbackText: payload.candidate_feedback_text,
      candidateFeedbackStreak: payload.candidate_feedback_streak,
      representativeFeedbackTotals: payload.representative_feedback_totals,
      representativeFeedbackCode: payload.representative_feedback_code,
      representativeFeedbackText: payload.representative_feedback_text,
      representativeFeedbackFrames: payload.representative_feedback_frames,
      baselineLeftStepExtent:
        payload.baseline_left_step_extent ?? this.aiState.baselineLeftStepExtent,
      baselineRightStepExtent:
        payload.baseline_right_step_extent ?? this.aiState.baselineRightStepExtent,
      baselineAnkleSpan: payload.baseline_ankle_span ?? this.aiState.baselineAnkleSpan,
      baselineLeftWristForward:
        payload.baseline_left_wrist_forward ?? this.aiState.baselineLeftWristForward,
      baselineRightWristForward:
        payload.baseline_right_wrist_forward ?? this.aiState.baselineRightWristForward,
      baselineStanceSpan: payload.baseline_stance_span ?? this.aiState.baselineStanceSpan,
      accuracy: payload.accuracy,
      tracking: payload.tracking,
      feedback: payload.feedback,
    }
  }

  private applyAiFeedback() {
    if (this.saveState !== 'idle') return

    const motionSpec = this.getCurrentAiMotionSpec()
    const progressText =
      motionSpec.type === 'daniel'
        ? `${Math.min(
            100,
            Math.round((this.aiState.holdDurationMs / motionSpec.targetHoldMs) * 100),
          )}%`
        : `${this.aiState.stepCount}/${motionSpec.targetSteps}`
    const title = this.aiState.feedback || this.aiState.representativeFeedbackText || 'Good'
    const detail = `Progress ${progressText}`

    this.feedbackTitleText?.setText(title)
    this.feedbackTipTexts[0]?.setText(detail)
    this.motionCounterText?.setText(
      `${this.modeLabel} ${this.motionIndex + 1}/${this.motions.length}`,
    )
    this.motionTitleText?.setText(this.motions[this.motionIndex].title)

    this.fitTextToWidth(this.motionCounterText, this.motionCounterMaxWidth, this.headerFontSize, 14)
    this.fitTextToWidth(this.motionTitleText, this.motionTitleMaxWidth, this.headerFontSize, 14)
    this.fitTextToWidth(this.feedbackTitleText, this.feedbackTitleMaxWidth, 34, 20)
    this.fitTextToWidth(this.feedbackTipTexts[0], this.feedbackTitleMaxWidth, 22, 14)
    this.positionFeedbackStar()
  }

  private recordCurrentMotionResult() {
    const motionSpec = this.getCurrentAiMotionSpec()
    if (
      this.motionResults.some(result => result.exerciseMotionId === motionSpec.exerciseMotionId)
    ) {
      return
    }

    const durationSec = Math.max(0, Math.round((Date.now() - this.motionStartedAtMs) / 1000))
    const accuracy = Phaser.Math.Clamp(this.aiState.accuracy, 0, 1)
    const completedReps =
      motionSpec.type === 'daniel'
        ? this.aiState.holdCompleted || this.aiState.holdDurationMs >= motionSpec.targetHoldMs
          ? 1
          : 0
        : this.aiState.stepCount
    const feedback =
      this.aiState.representativeFeedbackText ??
      this.aiState.displayedFeedbackText ??
      this.aiState.feedback ??
      ''

    this.motionResults.push({
      exerciseMotionId: motionSpec.exerciseMotionId,
      durationSec,
      accuracy,
      completedReps,
      feedback,
    })
  }

  private buildExerciseSessionPayload(): CreateExerciseSessionRequest {
    const patientProfileId = resolvePatientProfileId()
    if (!patientProfileId) {
      throw new Error('환자 정보가 올바르지 않습니다.')
    }

    const durationSec = Math.max(0, Math.round((Date.now() - this.sessionStartedAtMs) / 1000))
    return {
      patientProfileId,
      exerciseType: this.exerciseType,
      durationSec,
      averageAccuracy: calculateAverageAccuracy(this.motionResults),
      motions: this.motionResults,
    }
  }

  private async finishExerciseSession() {
    if (this.hasSubmittedSession || this.saveState === 'saving' || this.saveState === 'success')
      return

    this.recordCurrentMotionResult()
    this.hasSubmittedSession = true
    this.saveState = 'saving'
    this.isMotionAdvancing = true
    this.aiRequestsEnabled = false
    this.renderSaveState()

    try {
      const payload = this.buildExerciseSessionPayload()
      const savedSession = await createExerciseSession(payload)
      this.savedSession = savedSession
      this.saveState = 'success'
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [EXERCISE_SESSIONS_QUERY_KEY, savedSession.patientProfileId],
        }),
        queryClient.invalidateQueries({
          queryKey: [EXERCISE_SESSION_REPORT_QUERY_KEY, savedSession.patientProfileId],
        }),
      ])
      this.renderSaveState()
      this.time.delayedCall(1500, () => fadeToScene(this, 'GymnasticsSelectScene'))
    } catch (error) {
      console.warn('[GymnasticsPlayScene] Failed to save exercise session.', error)
      this.hasSubmittedSession = false
      this.saveState = 'error'
      this.renderSaveState()
    }
  }

  private renderSaveState() {
    this.saveRetryButton?.setVisible(this.saveState === 'error')

    if (this.saveState === 'saving') {
      this.feedbackTitleText?.setText('기록 저장 중')
      this.feedbackTipTexts[0]?.setText('기록을 저장하는 중입니다.')
    } else if (this.saveState === 'success') {
      const savedSession = this.savedSession
      this.feedbackTitleText?.setText('저장 완료')
      this.feedbackTipTexts[0]?.setText(
        savedSession
          ? `체조 기록이 저장되었습니다. ${formatExerciseType(
              savedSession.exerciseType,
            )} · ${formatDurationSec(savedSession.durationSec)} · ${formatAccuracy(
              savedSession.averageAccuracy,
            )}`
          : '체조 기록이 저장되었습니다.',
      )
    } else if (this.saveState === 'error') {
      this.feedbackTitleText?.setText('저장 실패')
      this.feedbackTipTexts[0]?.setText(CREATE_EXERCISE_SESSION_ERROR_MESSAGE)
    }

    this.fitTextToWidth(this.feedbackTitleText, this.feedbackTitleMaxWidth, 34, 20)
    this.fitTextToWidth(this.feedbackTipTexts[0], this.feedbackTitleMaxWidth, 22, 14)
    this.positionFeedbackStar()
  }

  private advanceMotionIfCompleted() {
    const motionSpec = this.getCurrentAiMotionSpec()
    const isComplete =
      motionSpec.type === 'daniel'
        ? this.aiState.holdCompleted || this.aiState.holdDurationMs >= motionSpec.targetHoldMs
        : this.aiState.stepCount >= motionSpec.targetSteps
    if (!isComplete || this.isMotionAdvancing) return

    this.isMotionAdvancing = true
    this.recordCurrentMotionResult()
    this.feedbackTitleText?.setText('Complete')
    this.time.delayedCall(700, () => {
      this.advanceToNextMotion(false)
    })
  }

  private advanceToNextMotion(manual: boolean) {
    if (manual && this.isMotionAdvancing) return

    if (this.motionIndex < this.motions.length - 1) {
      if (manual) {
        this.recordCurrentMotionResult()
      }
      this.motionIndex += 1
      this.aiState = createInitialAiState()
      this.aiError = null
      this.isMotionAdvancing = false
      this.motionStartedAtMs = Date.now()
      this.renderMotion()
      return
    }

    void this.finishExerciseSession()
  }

  private returnToPreviousMotion() {
    if (this.isMotionAdvancing || this.motionIndex <= 0) return

    this.motionIndex -= 1
    this.aiState = createInitialAiState()
    this.aiError = null
    this.renderMotion()
  }

  private getCurrentAiMotionSpec() {
    return this.aiSequence[this.motionIndex] ?? this.aiSequence[this.aiSequence.length - 1]
  }

  private toLandmarkPayload(
    landmarks: readonly { x: number; y: number; z: number; visibility?: number }[],
  ): LandmarkPayload[] {
    return landmarks.map((landmark, index) => ({
      name: POSE_LANDMARK_NAMES[index] ?? `LANDMARK_${index}`,
      x: landmark.x,
      y: landmark.y,
      z: landmark.z,
      visibility: landmark.visibility,
    }))
  }

  private updateRecognitionStatus(isRecognized: boolean) {
    if (this.isCameraRecognized === isRecognized) return
    this.isCameraRecognized = isRecognized
    this.statusDot.setFillStyle(isRecognized ? 0x1fbf5b : 0xd13b2f)
    this.statusText.setText(isRecognized ? '인식 중' : '인식 불가')
    this.feedbackTitleText?.setText(isRecognized ? '좋아요!' : '기다릴게요')
    if (this.feedbackTitleText) {
      this.layoutStatusBadge()
      this.fitTextToWidth(this.feedbackTitleText, this.feedbackTitleMaxWidth, 34, 20)
      this.positionFeedbackStar()
    }
  }

  private renderMotion() {
    const motion = this.motions[this.motionIndex]
    this.motionCounterText?.setText(this.modeLabel)
    this.motionTitleText?.setText(motion.title)
    this.timerText?.setText(this.formatTime(this.remainingSeconds))
    this.feedbackTitleText?.setText(this.isCameraRecognized ? '좋아요!' : '기다릴게요')
    this.fitTextToWidth(this.motionCounterText, this.motionCounterMaxWidth, this.headerFontSize, 14)
    this.fitTextToWidth(this.motionTitleText, this.motionTitleMaxWidth, this.headerFontSize, 14)
    this.fitTextToWidth(this.timerText, this.timerMaxWidth, this.headerFontSize, 14)
    this.fitTextToWidth(this.feedbackTitleText, this.feedbackTitleMaxWidth, 34, 20)
    this.positionFeedbackStar()
    this.feedbackTipTexts.forEach((text, index) => {
      text.setText(index === 0 ? motion.goal : '')
      this.fitTextToWidth(text, this.feedbackTitleMaxWidth, 22, 14)
    })
  }

  private positionFeedbackStar() {
    const starSize = Phaser.Math.Clamp(this.feedbackTitleText.height * 0.95, 32, 46)
    this.feedbackStarImage.setDisplaySize(starSize, starSize)
    const gap = Math.max(12, this.feedbackTitleText.height * 0.22)
    const groupW = this.feedbackStarImage.displayWidth + gap + this.feedbackTitleText.width
    const groupLeft = this.feedbackFrameBounds.x + (this.feedbackFrameBounds.width - groupW) / 2
    const starX = groupLeft + this.feedbackStarImage.displayWidth / 2
    const textX =
      groupLeft + this.feedbackStarImage.displayWidth + gap + this.feedbackTitleText.width / 2
    this.feedbackTitleText.setPosition(textX, this.feedbackTitleText.y)
    this.feedbackStarImage.setPosition(starX, this.feedbackTitleText.y)
  }

  private fitTextToWidth(
    text: Phaser.GameObjects.Text,
    maxWidth: number,
    maxFontSize: number,
    minFontSize: number,
  ) {
    let fontSize = maxFontSize
    text.setFontSize(fontSize)

    while (text.width > maxWidth && fontSize > minFontSize) {
      fontSize -= 1
      text.setFontSize(fontSize)
    }
  }

  private formatTime(totalSeconds: number) {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  private cleanup() {
    this.timerEvent?.remove(false)
    this.timerEvent = undefined
    this.poseTracker?.stop()
    this.poseTracker = null
    this.requestInFlight = false
  }
}

export class GymnasticsTopScene extends GymnasticsPlaySceneBase {
  constructor() {
    super('GymnasticsTopScene', TOP_AI_MOTIONS, 'top \uCCB4\uC870', 'TOP', TOP_AI_SEQUENCE)
  }
}

export class GymnasticsDanielScene extends GymnasticsPlaySceneBase {
  constructor() {
    super(
      'GymnasticsDanielScene',
      DANIEL_MOTIONS,
      '\uB2E4\uB2C8\uC5D8 \uCCB4\uC870',
      'DANIEL',
      DANIEL_AI_SEQUENCE,
    )
  }
}
