import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import { POSE_LANDMARK_NAMES, PoseTracker } from '../game/motion/poseTracker'

type LandmarkPayload = {
  name: string
  x: number
  y: number
  z?: number
  visibility?: number
}

type MarchApiResponse = {
  motion_id: string
  state: string
  step_count: number
  accuracy: number
  feedback: string | null
  tracking: string
  last_counted_side: string | null
  last_seen_side: string | null
  baseline_left_knee_y: number | null
  baseline_right_knee_y: number | null
  left_armed: boolean
  right_armed: boolean
  warmup_frames_remaining: number
  features: {
    left_knee_lift: number
    right_knee_lift: number
    left_knee_angle: number | null
    right_knee_angle: number | null
    torso_tilt: number
    baseline_left_knee_y: number | null
    baseline_right_knee_y: number | null
    current_left_knee_y: number | null
    current_right_knee_y: number | null
  }
}

type StateLogEntry = {
  state: string
  stepCount: number
  feedback: string | null
  timestampLabel: string
}

const DEFAULT_AI_BASE_URL = 'http://localhost:8001/api/v1'
const DEFAULT_TARGET_STEPS = 30
const DEFAULT_WARMUP_FRAMES = 15
const MAX_STATE_LOGS = 12

function MarchDebugPage() {
  const mountRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const trackerRef = useRef<PoseTracker | null>(null)
  const rafRef = useRef<number | null>(null)
  const requestInFlightRef = useRef(false)
  const previousStateRef = useRef('idle')
  const stepCountRef = useRef(0)
  const lastCountedSideRef = useRef<string | null>(null)
  const lastSeenSideRef = useRef<string | null>(null)
  const baselineLeftKneeYRef = useRef<number | null>(null)
  const baselineRightKneeYRef = useRef<number | null>(null)
  const leftArmedRef = useRef(true)
  const rightArmedRef = useRef(true)
  const warmupFramesRemainingRef = useRef(DEFAULT_WARMUP_FRAMES)

  const [aiBaseUrl, setAiBaseUrl] = useState(DEFAULT_AI_BASE_URL)
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState('Idle')
  const [result, setResult] = useState<MarchApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stateLogs, setStateLogs] = useState<StateLogEntry[]>([])

  useEffect(() => {
    return () => {
      stopTracking()
    }
  }, [])

  const resetEvaluatorState = () => {
    previousStateRef.current = 'idle'
    stepCountRef.current = 0
    lastCountedSideRef.current = null
    lastSeenSideRef.current = null
    baselineLeftKneeYRef.current = null
    baselineRightKneeYRef.current = null
    leftArmedRef.current = true
    rightArmedRef.current = true
    warmupFramesRemainingRef.current = DEFAULT_WARMUP_FRAMES
    setResult(null)
    setStateLogs([])
  }

  const startTracking = async () => {
    if (running) return

    try {
      setError(null)
      setStatus('Starting camera and pose tracker')

      const tracker = new PoseTracker()
      await tracker.start()
      trackerRef.current = tracker

      if (mountRef.current && tracker.video) {
        mountRef.current.innerHTML = ''
        tracker.video.style.width = '100%'
        tracker.video.style.height = '100%'
        tracker.video.style.objectFit = 'cover'
        tracker.video.style.transform = 'scaleX(-1)'
        mountRef.current.appendChild(tracker.video)
      }

      resetEvaluatorState()
      setRunning(true)
      setStatus('March test running')

      const loop = async () => {
        const activeTracker = trackerRef.current
        if (!activeTracker) return

        const detection = activeTracker.detect()
        const pose = detection.poses[0]
        drawPose(pose?.landmarks ?? [])

        if (pose && !requestInFlightRef.current) {
          requestInFlightRef.current = true

          try {
            const response = await fetch(`${aiBaseUrl}/gymnastics/march/evaluate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                frame: {
                  timestamp_ms: Math.floor(detection.timestampMs),
                  mirrored: true,
                  landmarks: toLandmarkPayload(pose.landmarks),
                },
                previous_state: previousStateRef.current,
                step_count: stepCountRef.current,
                target_steps: DEFAULT_TARGET_STEPS,
                last_counted_side: lastCountedSideRef.current,
                last_seen_side: lastSeenSideRef.current,
                baseline_left_knee_y: baselineLeftKneeYRef.current,
                baseline_right_knee_y: baselineRightKneeYRef.current,
                left_armed: leftArmedRef.current,
                right_armed: rightArmedRef.current,
                warmup_frames_remaining: warmupFramesRemainingRef.current,
              }),
            })

            if (!response.ok) {
              throw new Error(`AI response error: ${response.status}`)
            }

            const payload = (await response.json()) as MarchApiResponse

            if (payload.state !== previousStateRef.current) {
              const timestampLabel = new Date().toLocaleTimeString('ko-KR', {
                hour12: false,
              })
              setStateLogs(current =>
                [
                  {
                    state: payload.state,
                    stepCount: payload.step_count,
                    feedback: payload.feedback,
                    timestampLabel,
                  },
                  ...current,
                ].slice(0, MAX_STATE_LOGS),
              )
            }

            previousStateRef.current = payload.state
            stepCountRef.current = payload.step_count
            lastCountedSideRef.current = payload.last_counted_side
            lastSeenSideRef.current = payload.last_seen_side
            baselineLeftKneeYRef.current = payload.baseline_left_knee_y
            baselineRightKneeYRef.current = payload.baseline_right_knee_y
            leftArmedRef.current = payload.left_armed
            rightArmedRef.current = payload.right_armed
            warmupFramesRemainingRef.current = payload.warmup_frames_remaining
            setResult(payload)
            setStatus(payload.feedback ?? 'Running normally')
          } catch (fetchError) {
            const message =
              fetchError instanceof Error ? fetchError.message : 'AI evaluation request failed'
            setError(message)
            setStatus('AI response error')
          } finally {
            requestInFlightRef.current = false
          }
        }

        rafRef.current = window.requestAnimationFrame(loop)
      }

      rafRef.current = window.requestAnimationFrame(loop)
    } catch (startError) {
      const message = startError instanceof Error ? startError.message : 'Failed to start camera'
      setError(message)
      setStatus('Start failed')
      stopTracking()
    }
  }

  const stopTracking = () => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    requestInFlightRef.current = false
    trackerRef.current?.stop()
    trackerRef.current = null

    if (mountRef.current) {
      mountRef.current.innerHTML = ''
    }

    const canvas = canvasRef.current
    if (canvas) {
      const context = canvas.getContext('2d')
      context?.clearRect(0, 0, canvas.width, canvas.height)
    }

    setRunning(false)
    setStatus('Stopped')
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f4f6f8',
        color: '#18212f',
        padding: '24px',
        fontFamily: '"Pretendard", "Noto Sans KR", sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr',
          gap: '24px',
        }}
      >
        <section>
          <h1 style={{ margin: 0, fontSize: '32px' }}>March AI Debug</h1>
          <p style={{ marginTop: '8px', color: '#4d5b71' }}>
            Capture pose landmarks from the webcam, send them to the `march/evaluate` API, and
            inspect baseline-based knee raises, left/right alternation, and peak detection in real
            time.
          </p>
          <p style={{ marginTop: '4px', color: '#6b7280', fontSize: '14px' }}>
            Hold the ready pose for about 0.5 seconds after pressing Start so the warmup baseline
            can settle.
          </p>

          <label style={{ display: 'block', marginTop: '16px', fontWeight: 600 }}>
            AI Base URL
          </label>
          <input
            value={aiBaseUrl}
            onChange={event => setAiBaseUrl(event.target.value)}
            style={{
              width: '100%',
              marginTop: '8px',
              padding: '12px 14px',
              borderRadius: '12px',
              border: '1px solid #cad5e2',
              fontSize: '14px',
            }}
          />

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button
              onClick={() => void startTracking()}
              disabled={running}
              style={buttonStyle('#0b6bcb')}
            >
              Start
            </button>
            <button onClick={stopTracking} disabled={!running} style={buttonStyle('#b13b2e')}>
              Stop
            </button>
          </div>

          <div
            style={{
              position: 'relative',
              marginTop: '20px',
              width: '100%',
              aspectRatio: '4 / 3',
              background: '#111827',
              borderRadius: '20px',
              overflow: 'hidden',
            }}
          >
            <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />
            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            />
          </div>
        </section>

        <section
          style={{
            background: '#ffffff',
            borderRadius: '20px',
            padding: '20px',
            boxShadow: '0 10px 30px rgba(19, 33, 55, 0.08)',
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: '22px' }}>Live Result</h2>
          <InfoRow label="Status" value={status} />
          <InfoRow label="Error" value={error ?? '-'} />
          <InfoRow label="tracking" value={result?.tracking ?? '-'} />
          <InfoRow label="state" value={result?.state ?? '-'} />
          <InfoRow label="stepCount" value={String(result?.step_count ?? 0)} />
          <InfoRow label="accuracy" value={String(result?.accuracy ?? '-')} />
          <InfoRow label="feedback" value={result?.feedback ?? '-'} />
          <InfoRow label="warmupFrames" value={String(result?.warmup_frames_remaining ?? 0)} />
          <InfoRow label="leftArmed" value={String(result?.left_armed ?? true)} />
          <InfoRow label="rightArmed" value={String(result?.right_armed ?? true)} />
          <InfoRow label="baselineLeftKneeY" value={formatNumber(result?.baseline_left_knee_y)} />
          <InfoRow label="baselineRightKneeY" value={formatNumber(result?.baseline_right_knee_y)} />

          <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>Features</h3>
          <InfoRow label="leftKneeLift" value={formatNumber(result?.features.left_knee_lift)} />
          <InfoRow label="rightKneeLift" value={formatNumber(result?.features.right_knee_lift)} />
          <InfoRow label="leftKneeAngle" value={formatNumber(result?.features.left_knee_angle)} />
          <InfoRow label="rightKneeAngle" value={formatNumber(result?.features.right_knee_angle)} />
          <InfoRow label="torsoTilt" value={formatNumber(result?.features.torso_tilt)} />
          <InfoRow
            label="currentLeftKneeY"
            value={formatNumber(result?.features.current_left_knee_y)}
          />
          <InfoRow
            label="currentRightKneeY"
            value={formatNumber(result?.features.current_right_knee_y)}
          />

          <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>State Log</h3>
          <div
            style={{
              display: 'grid',
              gap: '10px',
              maxHeight: '280px',
              overflowY: 'auto',
            }}
          >
            {stateLogs.length === 0 ? (
              <div
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  background: '#f5f7fa',
                  color: '#66758c',
                }}
              >
                No state changes yet.
              </div>
            ) : (
              stateLogs.map((log, index) => (
                <div
                  key={`${log.timestampLabel}-${log.state}-${index}`}
                  style={{
                    padding: '14px',
                    borderRadius: '12px',
                    background: '#f5f7fa',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                    <strong>{log.state}</strong>
                    <span style={{ color: '#677489' }}>{log.timestampLabel}</span>
                  </div>
                  <div style={{ marginTop: '8px', color: '#425066', fontSize: '14px' }}>
                    stepCount: {log.stepCount}
                  </div>
                  <div style={{ marginTop: '4px', color: '#425066', fontSize: '14px' }}>
                    feedback: {log.feedback ?? '-'}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )

  function drawPose(landmarks: readonly { x: number; y: number }[]) {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    context.clearRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#5ce1e6'

    for (const landmark of landmarks) {
      context.beginPath()
      context.arc((1 - landmark.x) * canvas.width, landmark.y * canvas.height, 4, 0, Math.PI * 2)
      context.fill()
    }
  }
}

function toLandmarkPayload(
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '10px 0',
        borderBottom: '1px solid #e8edf3',
        gap: '16px',
      }}
    >
      <strong>{label}</strong>
      <span style={{ textAlign: 'right', color: '#425066' }}>{value}</span>
    </div>
  )
}

function formatNumber(value: number | null | undefined) {
  if (value == null) return '-'
  return value.toFixed(3)
}

function buttonStyle(background: string) {
  return {
    border: 'none',
    borderRadius: '12px',
    padding: '12px 18px',
    background,
    color: '#fff',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
  } satisfies CSSProperties
}

export default MarchDebugPage
