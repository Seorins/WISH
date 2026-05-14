package com.comong.backend.domain.quiz.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.comong.backend.domain.patient.entity.PatientProfile;
import com.comong.backend.domain.patient.service.PatientProfileService;
import com.comong.backend.domain.quiz.dto.PromptAssignment;
import com.comong.backend.domain.quiz.dto.QuizRoomEvent;
import com.comong.backend.domain.quiz.dto.QuizRoomSnapshot;
import com.comong.backend.domain.quiz.exception.QuizNotRoomHostException;
import com.comong.backend.domain.quiz.exception.QuizPatientProfileMissingException;
import com.comong.backend.domain.quiz.exception.QuizRoomNotFoundException;

import lombok.RequiredArgsConstructor;

/**
 * 그림 퀴즈 방 유스케이스 — REST 컨트롤러와 STOMP 핸들러가 공유하는 진입점 (S14P31E103-820).
 *
 * <p>책임:
 *
 * <ol>
 *   <li>userId 를 PatientProfile 로 해석해 nickname/profileId 를 얻는다 — 환자 프로필이 없으면 입장 자체를 거부.
 *   <li>{@link QuizRoomRegistry} 에 위임해 방 상태를 변경.
 *   <li>{@link QuizBroadcastService} 로 방 토픽에 이벤트 fan-out.
 * </ol>
 *
 * <p>readOnly 트랜잭션은 PatientProfile 조회 한정 — 방 상태는 DB 가 아니라 인메모리이므로 트랜잭션 경계 밖이다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class QuizRoomService {

    private final QuizRoomRegistry roomRegistry;
    private final QuizBroadcastService broadcastService;
    private final PatientProfileService patientProfileService;
    private final QuizPromptCatalog promptCatalog;

    /** 새 방 생성 — 호스트가 첫 멤버로 자동 등록된다. broadcast 는 아직 구독자가 없으므로 생략. */
    public QuizRoomSnapshot createRoom(long userId) {
        PatientProfile profile = requireProfile(userId);
        QuizRoom room = roomRegistry.createRoom(userId, profile.getId(), profile.getNickname());
        return QuizRoomSnapshot.of(room);
    }

    /** 코드로 입장. 입장 성공 시 방 토픽에 {@code member_joined} broadcast. */
    public QuizRoomSnapshot joinByCode(long userId, String code) {
        PatientProfile profile = requireProfile(userId);
        QuizRoom room =
                roomRegistry.joinByCode(code, userId, profile.getId(), profile.getNickname());
        QuizMember joined =
                room.findMember(userId)
                        .orElseThrow(() -> new IllegalStateException("joined member missing"));
        boolean isHost = room.hostUserId() == userId;
        broadcastService.broadcastEvent(room.roomId(), QuizRoomEvent.memberJoined(joined, isHost));
        return QuizRoomSnapshot.of(room);
    }

    /**
     * 명시 퇴장. WS disconnect 와 동일 경로로 합쳐도 되지만, REST 호출 시 즉시 fan-out 을 보장해 UX 가 부드러워진다.
     *
     * <p>호스트가 바뀐 경우 {@code host_changed} 도 함께 broadcast.
     */
    public void leave(long userId) {
        roomRegistry
                .leave(userId)
                .ifPresent(
                        result -> {
                            String roomId = result.room().roomId();
                            broadcastService.broadcastEvent(
                                    roomId, QuizRoomEvent.memberLeft(userId));
                            if (!result.closed()
                                    && result.room().hostUserId() != userId
                                    && result.room().hostUserId() != 0L) {
                                broadcastService.broadcastEvent(
                                        roomId,
                                        QuizRoomEvent.hostChanged(result.room().hostUserId()));
                            }
                        });
    }

    /** 특정 방 스냅샷 조회 — 멤버 검증은 컨트롤러가 책임 (재접속 시나리오). */
    public QuizRoomSnapshot snapshot(String roomId) {
        return roomRegistry
                .findById(roomId)
                .map(QuizRoomSnapshot::of)
                .orElseThrow(QuizRoomNotFoundException::new);
    }

    /**
     * 방장 요청으로 다음 라운드를 시작한다 (M2-2). 흐름:
     *
     * <ol>
     *   <li>방 검증 — 존재 + 호출자가 방장
     *   <li>제시어 선택 — 직전 단어와 다른 단어로
     *   <li>{@link QuizRoomRegistry#startNextRound} — 상태 PLAYING 전이 + 출제자 결정 (lock 안)
     *   <li>방 전체에 {@code round_started} broadcast — status / 라운드 / 출제자 공개
     *   <li>출제자에게만 user queue 로 제시어 push
     * </ol>
     *
     * @return 변경 후 룸 스냅샷
     * @throws QuizRoomNotFoundException 방이 없음
     * @throws QuizNotRoomHostException 호출자가 방장이 아님
     */
    public QuizRoomSnapshot startGame(long userId, String roomId) {
        QuizRoom roomSnapshot =
                roomRegistry.findById(roomId).orElseThrow(QuizRoomNotFoundException::new);
        if (roomSnapshot.hostUserId() != userId) {
            throw new QuizNotRoomHostException();
        }
        // 직전 단어는 currentPrompt — null 일 수도(첫 라운드) 있다.
        String previousWord =
                roomSnapshot.currentPrompt() == null ? null : roomSnapshot.currentPrompt().word();
        DrawingPrompt prompt = promptCatalog.pickRandom(previousWord);

        QuizRoom updated = roomRegistry.startNextRound(roomId, prompt);

        broadcastService.broadcastEvent(
                roomId,
                QuizRoomEvent.roundStarted(updated.roundNumber(), updated.currentDrawerUserId()));
        broadcastService.sendPromptToUser(
                String.valueOf(updated.currentDrawerUserId()),
                roomId,
                new PromptAssignment(updated.roundNumber(), prompt.word(), prompt.hint()));

        return QuizRoomSnapshot.of(updated);
    }

    private PatientProfile requireProfile(long userId) {
        return patientProfileService
                .findEntityByUserId(userId)
                .orElseThrow(QuizPatientProfileMissingException::new);
    }
}
