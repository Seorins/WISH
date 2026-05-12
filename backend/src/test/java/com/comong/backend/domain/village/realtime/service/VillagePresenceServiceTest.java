package com.comong.backend.domain.village.realtime.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.comong.backend.domain.patient.entity.PatientProfile;
import com.comong.backend.domain.patient.service.PatientProfileService;
import com.comong.backend.domain.village.realtime.config.VillageRealtimeProperties;
import com.comong.backend.domain.village.realtime.exception.VillagePatientProfileMissingException;
import com.comong.backend.domain.village.realtime.exception.VillageRoomFullException;

/**
 * VillagePresenceService 의 핵심 동작 단위 검증. Spring 컨텍스트 없이 mock 만으로 빠르게 돈다.
 *
 * <ul>
 *   <li>캡 검증 + 캡 초과 거부
 *   <li>같은 userId 재접속 시 latest-wins (위치/외형 유지, 세션만 교체)
 *   <li>session disconnect 시 leave (단, latest-wins 로 evicted 된 옛 세션의 늦은 disconnect 는 새 멤버를 지우지 않음)
 *   <li>idle TTL 초과 시 evictIdle 가 제거
 *   <li>PatientProfile 없는 사용자는 join 거부
 * </ul>
 */
class VillagePresenceServiceTest {

    private static final int CAPACITY = 3;
    private static final int IDLE_SECONDS = 30;

    private PatientProfileService patientProfileService;
    private VillagePresenceService presenceService;

    @BeforeEach
    void setUp() {
        VillageRealtimeProperties properties =
                new VillageRealtimeProperties(true, 5, CAPACITY, IDLE_SECONDS);
        patientProfileService = mock(PatientProfileService.class);
        presenceService = new VillagePresenceService(properties, patientProfileService);
    }

    @Test
    void joinAddsMemberWithProfileNickname() {
        stubProfile(1L, 100L, "꼬마곰");

        VillagePresenceService.JoinResult result = presenceService.join("session-a", 1L);

        assertThat(result.outcome()).isEqualTo(VillagePresenceService.JoinOutcome.JOINED);
        assertThat(result.member().nickname()).isEqualTo("꼬마곰");
        assertThat(result.member().patientProfileId()).isEqualTo(100L);
        assertThat(result.member().sessionId()).isEqualTo("session-a");
        assertThat(result.evicted()).isEmpty();
        assertThat(presenceService.size()).isEqualTo(1);
    }

    @Test
    void joinRejectsWhenPatientProfileMissing() {
        when(patientProfileService.findEntityByUserId(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> presenceService.join("session-x", 99L))
                .isInstanceOf(VillagePatientProfileMissingException.class);
        assertThat(presenceService.size()).isZero();
    }

    @Test
    void joinRejectsWhenRoomFull() {
        stubProfile(1L, 100L, "n1");
        stubProfile(2L, 101L, "n2");
        stubProfile(3L, 102L, "n3");
        stubProfile(4L, 103L, "n4");

        presenceService.join("s1", 1L);
        presenceService.join("s2", 2L);
        presenceService.join("s3", 3L);

        assertThatThrownBy(() -> presenceService.join("s4", 4L))
                .isInstanceOf(VillageRoomFullException.class);
        assertThat(presenceService.size()).isEqualTo(CAPACITY);
    }

    @Test
    void rejoinByExistingUserIdIsLatestWinsAndDoesNotConsumeCapacity() {
        stubProfile(1L, 100L, "n1");
        stubProfile(2L, 101L, "n2");
        stubProfile(3L, 102L, "n3");

        presenceService.join("s1", 1L);
        presenceService.join("s2", 2L);
        presenceService.join("s3", 3L);

        VillagePresenceService.JoinResult replaced = presenceService.join("s2-new", 2L);

        assertThat(replaced.outcome()).isEqualTo(VillagePresenceService.JoinOutcome.REPLACED);
        assertThat(replaced.member().sessionId()).isEqualTo("s2-new");
        assertThat(replaced.evicted()).isPresent();
        assertThat(replaced.evicted().get().sessionId()).isEqualTo("s2");
        assertThat(presenceService.size()).isEqualTo(CAPACITY);
        assertThat(presenceService.findBySessionId("s2")).isEmpty();
        assertThat(presenceService.findBySessionId("s2-new")).isPresent();
    }

    @Test
    void leaveBySessionRemovesMember() {
        stubProfile(1L, 100L, "n1");
        presenceService.join("s1", 1L);

        Optional<PlayerState> left = presenceService.leaveBySession("s1");

        assertThat(left).isPresent();
        assertThat(left.get().userId()).isEqualTo(1L);
        assertThat(presenceService.size()).isZero();
    }

    @Test
    void leaveByEvictedSessionDoesNotRemoveNewMember() {
        // latest-wins 후 옛 세션의 늦은 disconnect 이벤트가 새 세션의 presence 를 지우면 안 된다.
        stubProfile(1L, 100L, "n1");
        presenceService.join("s1-old", 1L);
        presenceService.join("s1-new", 1L); // replaced

        Optional<PlayerState> stale = presenceService.leaveBySession("s1-old");

        assertThat(stale).isEmpty();
        assertThat(presenceService.findByUserId(1L)).isPresent();
        assertThat(presenceService.findByUserId(1L).get().sessionId()).isEqualTo("s1-new");
    }

    @Test
    void evictIdleRemovesMembersIdleBeyondThreshold() {
        stubProfile(1L, 100L, "n1");
        stubProfile(2L, 101L, "n2");
        presenceService.join("s1", 1L);
        presenceService.join("s2", 2L);

        // 모든 멤버의 lastSeen 보다 threshold 이상 미래 시각으로 evictIdle 호출
        Instant farFuture = Instant.now().plusSeconds(IDLE_SECONDS + 10);
        var evicted = presenceService.evictIdle(farFuture);

        assertThat(evicted).hasSize(2);
        assertThat(presenceService.size()).isZero();
        assertThat(presenceService.findBySessionId("s1")).isEmpty();
        assertThat(presenceService.findBySessionId("s2")).isEmpty();
    }

    @Test
    void updatePositionAppliesNewCoordinates() {
        stubProfile(1L, 100L, "n1");
        presenceService.join("s1", 1L);

        Optional<PlayerState> updated = presenceService.updatePosition(1L, 0.42, 0.78, "left");

        assertThat(updated).isPresent();
        assertThat(updated.get().x()).isEqualTo(0.42);
        assertThat(updated.get().y()).isEqualTo(0.78);
        assertThat(updated.get().dir()).isEqualTo("left");
        assertThat(presenceService.findByUserId(1L).get().x()).isEqualTo(0.42);
    }

    @Test
    void updatePositionReturnsEmptyForUnknownUser() {
        Optional<PlayerState> updated = presenceService.updatePosition(999L, 0.1, 0.1, "down");

        assertThat(updated).isEmpty();
    }

    @Test
    void evictIdleSkipsFreshMembers() {
        stubProfile(1L, 100L, "n1");
        presenceService.join("s1", 1L);

        // threshold 이내라 정리 안 됨
        Instant slightlyLater = Instant.now().plusSeconds(IDLE_SECONDS - 5);
        var evicted = presenceService.evictIdle(slightlyLater);

        assertThat(evicted).isEmpty();
        assertThat(presenceService.size()).isEqualTo(1);
    }

    private void stubProfile(long userId, long profileId, String nickname) {
        PatientProfile profile = mock(PatientProfile.class);
        when(profile.getId()).thenReturn(profileId);
        when(profile.getNickname()).thenReturn(nickname);
        when(patientProfileService.findEntityByUserId(userId)).thenReturn(Optional.of(profile));
    }
}
