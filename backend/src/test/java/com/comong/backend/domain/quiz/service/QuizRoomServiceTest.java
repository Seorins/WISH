package com.comong.backend.domain.quiz.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.comong.backend.domain.patient.entity.PatientProfile;
import com.comong.backend.domain.patient.service.PatientProfileService;
import com.comong.backend.domain.quiz.config.QuizRealtimeProperties;
import com.comong.backend.domain.quiz.dto.QuizRoomEvent;
import com.comong.backend.domain.quiz.dto.QuizRoomSnapshot;
import com.comong.backend.domain.quiz.exception.QuizAlreadyInRoomException;
import com.comong.backend.domain.quiz.exception.QuizPatientProfileMissingException;
import com.comong.backend.domain.quiz.exception.QuizRoomFullException;
import com.comong.backend.domain.quiz.exception.QuizRoomNotFoundException;

/** {@link QuizRoomService} 핵심 경로 (생성/입장/퇴장/호스트 승계/정원) 검증. */
class QuizRoomServiceTest {

    private static final int MIN = 2;
    private static final int MAX = 4;

    private PatientProfileService patientProfileService;
    private QuizBroadcastService broadcastService;
    private QuizRoomRegistry registry;
    private QuizRoomService service;

    @BeforeEach
    void setUp() {
        patientProfileService = mock(PatientProfileService.class);
        broadcastService = mock(QuizBroadcastService.class);
        QuizRealtimeProperties properties = new QuizRealtimeProperties(true, MIN, MAX, 90, 60);
        registry = new QuizRoomRegistry(properties);
        service = new QuizRoomService(registry, broadcastService, patientProfileService);
    }

    @Test
    void createRoomMakesCallerHostAndDoesNotBroadcast() {
        stubProfile(1L, 100L, "꼬마곰");

        QuizRoomSnapshot snapshot = service.createRoom(1L);

        assertThat(snapshot.hostUserId()).isEqualTo(1L);
        assertThat(snapshot.members()).hasSize(1);
        assertThat(snapshot.members().get(0).isHost()).isTrue();
        assertThat(snapshot.code()).hasSize(6);
        // 호스트만 있는 시점엔 구독자가 없으므로 broadcast 안 함.
        verify(broadcastService, never()).broadcastEvent(anyString(), any());
    }

    @Test
    void createRoomWithoutPatientProfileIsRejected() {
        when(patientProfileService.findEntityByUserId(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.createRoom(99L))
                .isInstanceOf(QuizPatientProfileMissingException.class);
    }

    @Test
    void joinByCodeAddsMemberAndBroadcastsMemberJoined() {
        stubProfile(1L, 100L, "host");
        stubProfile(2L, 101L, "guest");

        QuizRoomSnapshot host = service.createRoom(1L);
        QuizRoomSnapshot joined = service.joinByCode(2L, host.code());

        assertThat(joined.members()).hasSize(2);
        assertThat(joined.hostUserId()).isEqualTo(1L);
        verify(broadcastService, times(1))
                .broadcastEvent(eq(host.roomId()), any(QuizRoomEvent.class));
    }

    @Test
    void joinByCodeRejectsUnknownCode() {
        stubProfile(1L, 100L, "x");

        assertThatThrownBy(() -> service.joinByCode(1L, "ABCDEF"))
                .isInstanceOf(QuizRoomNotFoundException.class);
    }

    @Test
    void joinByCodeRejectsWhenRoomFull() {
        stubProfile(1L, 100L, "h");
        stubProfile(2L, 101L, "a");
        stubProfile(3L, 102L, "b");
        stubProfile(4L, 103L, "c");
        stubProfile(5L, 104L, "overflow");

        QuizRoomSnapshot host = service.createRoom(1L);
        service.joinByCode(2L, host.code());
        service.joinByCode(3L, host.code());
        service.joinByCode(4L, host.code());

        assertThatThrownBy(() -> service.joinByCode(5L, host.code()))
                .isInstanceOf(QuizRoomFullException.class);
    }

    @Test
    void userCannotCreateOrJoinWhileAlreadyInRoom() {
        stubProfile(1L, 100L, "h");

        QuizRoomSnapshot first = service.createRoom(1L);

        assertThatThrownBy(() -> service.createRoom(1L))
                .isInstanceOf(QuizAlreadyInRoomException.class);
        assertThatThrownBy(() -> service.joinByCode(1L, first.code()))
                .isInstanceOf(QuizAlreadyInRoomException.class);
    }

    @Test
    void leaveByGuestBroadcastsMemberLeftButNotHostChanged() {
        stubProfile(1L, 100L, "h");
        stubProfile(2L, 101L, "g");

        QuizRoomSnapshot host = service.createRoom(1L);
        service.joinByCode(2L, host.code());
        service.leave(2L);

        verify(broadcastService, atLeastOnce())
                .broadcastEvent(eq(host.roomId()), any(QuizRoomEvent.class));
        assertThat(registry.findById(host.roomId())).isPresent();
        assertThat(registry.findById(host.roomId()).get().memberCount()).isEqualTo(1);
        assertThat(registry.findById(host.roomId()).get().hostUserId()).isEqualTo(1L);
    }

    @Test
    void leaveByHostPromotesNextEarliestMember() {
        stubProfile(1L, 100L, "h");
        stubProfile(2L, 101L, "g1");
        stubProfile(3L, 102L, "g2");

        QuizRoomSnapshot host = service.createRoom(1L);
        service.joinByCode(2L, host.code());
        service.joinByCode(3L, host.code());
        service.leave(1L);

        assertThat(registry.findById(host.roomId()).orElseThrow().hostUserId()).isEqualTo(2L);
    }

    @Test
    void leaveByLastMemberClosesRoom() {
        stubProfile(1L, 100L, "h");

        QuizRoomSnapshot host = service.createRoom(1L);
        service.leave(1L);

        assertThat(registry.findById(host.roomId())).isEmpty();
        assertThat(registry.roomCount()).isZero();
    }

    @Test
    void leaveWithoutRoomIsNoop() {
        // 멤버 아닌 사용자가 호출해도 예외/broadcast 없이 조용히 지나간다.
        service.leave(999L);
        verify(broadcastService, never()).broadcastEvent(anyString(), any());
    }

    private void stubProfile(long userId, long profileId, String nickname) {
        PatientProfile profile = mock(PatientProfile.class);
        when(profile.getId()).thenReturn(profileId);
        when(profile.getNickname()).thenReturn(nickname);
        when(patientProfileService.findEntityByUserId(userId)).thenReturn(Optional.of(profile));
    }
}
