import { useCallback, useEffect, useRef, useState } from 'react'
import {
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Room,
  RoomEvent,
  Track,
} from 'livekit-client'
import { requestGuardianLivekitToken } from '@wish/api-client'

export type LiveKitViewerStatus =
  | 'idle'
  | 'requesting-token'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error'

type Options = {
  loginSessionId: number | null
  videoRef: React.RefObject<HTMLVideoElement | null>
  audioRef: React.RefObject<HTMLAudioElement | null>
}

// 보호자앱 LiveKit viewer 훅.
// loginSessionId 가 들어오면 guardian-token 발급 → Room.connect → 원격 video/audio track 자동 attach.
// sessionId 가 바뀌거나 사라지면 disconnect 후 정리. 토큰 만료 후 재연결은 v1 범위 밖 — 사용자가
// 새로고침/재진입하면 다음 GAME_STARTED 사이클에서 새 토큰을 받는다.
//
// 영상/오디오는 LiveKit 의 track.attach() 가 element 의 srcObject 를 직접 설정한다.
// autoplay 정책상 보호자가 사용자 제스처 전이면 audio 가 막힐 수 있어 audio element 는
// muted=false 가 사용자 액션 이후 (소리 켜기 버튼 — 후속 체크포인트) 에 들어간다.
export function useLiveKitViewer({ loginSessionId, videoRef, audioRef }: Options) {
  const [status, setStatus] = useState<LiveKitViewerStatus>('idle')
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false)
  const roomRef = useRef<Room | null>(null)

  useEffect(() => {
    if (loginSessionId === null) {
      setStatus('idle')
      setHasRemoteVideo(false)
      return
    }

    let cancelled = false
    setStatus('requesting-token')

    const room = new Room()
    roomRef.current = room

    const attachSubscribedTrack = (
      track: RemoteTrack,
      _publication: RemoteTrackPublication,
      _participant: RemoteParticipant,
    ) => {
      if (track.kind === Track.Kind.Video && videoRef.current) {
        track.attach(videoRef.current)
        setHasRemoteVideo(true)
      } else if (track.kind === Track.Kind.Audio && audioRef.current) {
        track.attach(audioRef.current)
      }
    }

    const detachUnsubscribedTrack = (track: RemoteTrack) => {
      track.detach()
      if (track.kind === Track.Kind.Video) {
        setHasRemoteVideo(false)
      }
    }

    room.on(RoomEvent.TrackSubscribed, attachSubscribedTrack)
    room.on(RoomEvent.TrackUnsubscribed, detachUnsubscribedTrack)
    room.on(RoomEvent.Disconnected, () => {
      if (cancelled) return
      setStatus('disconnected')
      setHasRemoteVideo(false)
    })

    const connect = async () => {
      try {
        const response = await requestGuardianLivekitToken(loginSessionId)
        if (cancelled) return
        const { livekitUrl, token } = response.data
        setStatus('connecting')
        await room.connect(livekitUrl, token)
        if (cancelled) {
          await room.disconnect()
          return
        }
        setStatus('connected')
        // 이미 publish 중인 track 이 있을 수 있으니 한 번 훑어 즉시 attach.
        for (const participant of room.remoteParticipants.values()) {
          for (const publication of participant.trackPublications.values()) {
            if (publication.isSubscribed && publication.track) {
              attachSubscribedTrack(publication.track, publication, participant)
            }
          }
        }
      } catch (error) {
        if (cancelled) return
        console.warn('LiveKit viewer connection failed', error)
        setStatus('error')
      }
    }

    void connect()

    return () => {
      cancelled = true
      roomRef.current = null
      room.removeAllListeners()
      void room.disconnect()
    }
  }, [loginSessionId, videoRef, audioRef])

  const setMicrophoneEnabled = useCallback(async (enabled: boolean) => {
    const room = roomRef.current
    if (!room) throw new Error('LiveKit room not connected')
    await room.localParticipant.setMicrophoneEnabled(enabled)
  }, [])

  return { status, hasRemoteVideo, setMicrophoneEnabled }
}
