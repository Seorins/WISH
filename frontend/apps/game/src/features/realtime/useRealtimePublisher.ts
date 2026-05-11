import { useEffect } from 'react'
import {
  LocalVideoTrack,
  type RemoteParticipant,
  type RemoteTrack,
  Room,
  RoomEvent,
  Track,
} from 'livekit-client'
import { requestGameLivekitToken } from '@wish/api-client'
import { useLoginSessionStore } from '../../stores/loginSessionStore'

// 보호자 participant 의 identity prefix — BE RealtimeLiveKitNaming 과 동기화 필요.
// 변경되면 양쪽 같이 손봐야 한다.
const GUARDIAN_IDENTITY_PREFIX = 'guardian-'

// 캔버스 publish 시 사용할 인코딩 캡. dev 시연 환경(MacBook + 가정용 와이파이) 기준
// 3Mbps / 30fps + h264 코덱으로 픽셀 도트 그래픽이 흐려지지 않게 한다. 업링크 여유가
// 부족한 환경이라면 캡을 다시 내릴 것.
const PUBLISH_MAX_BITRATE = 3_000_000
const PUBLISH_FRAMERATE = 30

// 게임앱 LiveKit publisher 훅.
// 1) loginSessionId(activeSession) + canvas 가 둘 다 준비되면 game-token 받아 room.connect
// 2) 보호자 participant 가 입장하기 전엔 publish 하지 않는다 (업링크 자원 절약)
// 3) 보호자 입장 시점에 canvas.captureStream() 으로 video track 1개 publish
// 4) 보호자가 모두 떠나면 unpublish
// 5) 보호자 audio track 은 자동 subscribe 되어 body 에 hidden <audio> 로 attach (PTT 수신)
//
// 다음 가정에 의존한다:
// - BE token 응답이 LiveKit Cloud URL/JWT 를 그대로 내려준다 (FE env 비밀 0)
// - 보호자 participant identity 는 'guardian-' 으로 시작 (BE RealtimeLiveKitNaming)
// - canvas 는 Phaser 의 preserveDrawingBuffer=true 로 만들어진 동일 element
export function useRealtimePublisher(canvas: HTMLCanvasElement | null) {
  const loginSessionId = useLoginSessionStore(state => state.loginSessionId)

  useEffect(() => {
    if (loginSessionId === null || canvas === null) return

    let cancelled = false
    const room = new Room()
    let videoTrack: LocalVideoTrack | null = null
    const attachedAudioElements: HTMLAudioElement[] = []

    const isGuardian = (participant: RemoteParticipant) =>
      participant.identity.startsWith(GUARDIAN_IDENTITY_PREFIX)

    const guardiansPresent = () => Array.from(room.remoteParticipants.values()).some(isGuardian)

    const ensurePublishing = async () => {
      if (videoTrack || cancelled) return
      const stream = canvas.captureStream(PUBLISH_FRAMERATE)
      const [mediaTrack] = stream.getVideoTracks()
      if (!mediaTrack) return
      const localTrack = new LocalVideoTrack(mediaTrack)
      try {
        await room.localParticipant.publishTrack(localTrack, {
          source: Track.Source.Camera,
          // h264 가 하드웨어 디코딩 지원이 넓어 보호자 측 끊김/지터에 유리. vp8 보다 같은 bitrate
          // 에서 도트 그래픽 가독성도 양호. simulcast 는 단일 viewer 라 비활성.
          videoCodec: 'h264',
          simulcast: false,
          videoEncoding: {
            maxBitrate: PUBLISH_MAX_BITRATE,
            maxFramerate: PUBLISH_FRAMERATE,
          },
        })
        if (cancelled) {
          await room.localParticipant.unpublishTrack(localTrack, true)
          return
        }
        videoTrack = localTrack
      } catch (error) {
        console.warn('Game LiveKit publish failed', error)
        localTrack.stop()
      }
    }

    const stopPublishing = async () => {
      const track = videoTrack
      if (!track) return
      videoTrack = null
      try {
        await room.localParticipant.unpublishTrack(track, true)
      } catch (error) {
        console.warn('Game LiveKit unpublish failed', error)
      }
    }

    const handleSubscribedTrack = (track: RemoteTrack, participant: RemoteParticipant) => {
      if (track.kind !== Track.Kind.Audio || !isGuardian(participant)) return
      const audioEl = track.attach() as HTMLAudioElement
      audioEl.dataset.realtime = 'guardian-audio'
      document.body.appendChild(audioEl)
      attachedAudioElements.push(audioEl)
    }

    const handleUnsubscribedTrack = (track: RemoteTrack) => {
      if (track.kind !== Track.Kind.Audio) return
      const detached = track.detach() as HTMLAudioElement[]
      detached.forEach(el => el.remove())
    }

    room.on(RoomEvent.ParticipantConnected, participant => {
      if (isGuardian(participant)) void ensurePublishing()
    })
    room.on(RoomEvent.ParticipantDisconnected, participant => {
      if (isGuardian(participant) && !guardiansPresent()) void stopPublishing()
    })
    room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
      handleSubscribedTrack(track, participant)
    })
    room.on(RoomEvent.TrackUnsubscribed, track => {
      handleUnsubscribedTrack(track)
    })

    const connect = async () => {
      try {
        const response = await requestGameLivekitToken(loginSessionId)
        if (cancelled) return
        const { livekitUrl, token } = response.data
        await room.connect(livekitUrl, token)
        if (cancelled) {
          await room.disconnect()
          return
        }
        // 보호자가 먼저 들어와 있는 경우(예: 게임 재진입) — 즉시 publish.
        if (guardiansPresent()) await ensurePublishing()
      } catch (error) {
        console.warn('Game LiveKit publisher connection failed', error)
      }
    }

    void connect()

    return () => {
      cancelled = true
      attachedAudioElements.forEach(el => el.remove())
      void stopPublishing().finally(() => {
        void room.disconnect()
      })
    }
  }, [loginSessionId, canvas])
}
