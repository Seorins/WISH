package com.comong.backend.domain.village.realtime.service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

import org.springframework.stereotype.Service;

import com.comong.backend.domain.patient.entity.PatientProfile;
import com.comong.backend.domain.patient.service.PatientProfileService;
import com.comong.backend.domain.village.realtime.config.VillageRealtimeProperties;
import com.comong.backend.domain.village.realtime.exception.VillagePatientProfileMissingException;
import com.comong.backend.domain.village.realtime.exception.VillageRoomFullException;

import lombok.RequiredArgsConstructor;

/**
 * 마을 광장 멤버 presence 인메모리 저장소.
 *
 * <p>단일 룸 ({@code village.default}) 가정 — 멀티 룸이 필요해지면 외부에 {@code Map<roomId, ...>} 한 단계 추가.
 *
 * <p>운영 가정:
 *
 * <ul>
 *   <li><b>단일 인스턴스</b>: 인메모리 ConcurrentHashMap. 멀티 인스턴스 운영 시 Redis 등으로 외부 store 교체 필요.
 *   <li><b>동시성</b>: 캡 검증 + add 의 원자성은 {@link ReentrantLock} 으로 직렬화. 동접 30명 규모에선 충돌 거의 없음.
 *   <li><b>latest-wins</b>: 같은 {@code userId} 로 새 세션이 들어오면 기존 세션 ID 를 무효화하고 위치/외형은 유지 (계획서 14절 결정).
 *   <li><b>idle cleanup</b>: {@code @Scheduled} 가 주기 호출하는 {@link #evictIdle(Instant)} 가 좀비 세션 정리.
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class VillagePresenceService {

    /** 스폰 시 사용할 기본 외형 키 — FE {@code player.ts} 의 {@code PLAYER_TEXTURE_KEY} 와 동기. */
    private static final String DEFAULT_TEXTURE_KEY = "character";

    /** 기본 방향. FE {@code PlayerDirection} 의 디폴트와 동일. */
    private static final String DEFAULT_DIR = "down";

    /** VillageScene 의 {@code DEFAULT_PLAYER_SPAWN} (xRatio, yRatio) 와 동기. */
    private static final double DEFAULT_X_RATIO = 0.5;

    private static final double DEFAULT_Y_RATIO = 0.3;

    private final VillageRealtimeProperties properties;
    private final PatientProfileService patientProfileService;

    private final Map<Long, PlayerState> members = new ConcurrentHashMap<>();
    private final Map<String, Long> sessionIndex = new ConcurrentHashMap<>();
    private final Map<Long, Instant> lastEmoteByUserId = new ConcurrentHashMap<>();
    private final ReentrantLock lock = new ReentrantLock();

    /** 이모티콘 서버측 throttle 간격. 도배 차단 — 클라가 1s throttle 을 우회해도 서버가 막는다 (S14P31E103-728). */
    private static final Duration EMOTE_THROTTLE = Duration.ofSeconds(2);

    public enum JoinOutcome {
        JOINED,
        REPLACED
    }

    public record JoinResult(
            JoinOutcome outcome, PlayerState member, Optional<PlayerState> evicted) {}

    /**
     * 신규 STOMP 세션을 룸에 추가.
     *
     * <p>호출 순서:
     *
     * <ol>
     *   <li>PatientProfile 조회 (없으면 거부)
     *   <li>락 획득 후 캡 검증 + latest-wins
     *   <li>members / sessionIndex 갱신
     * </ol>
     *
     * @throws VillagePatientProfileMissingException 보호자 단독 계정 등 환자 프로필이 없을 때
     * @throws VillageRoomFullException 캡 초과 (단, 같은 userId 재접속은 캡 검증 skip)
     */
    public JoinResult join(String sessionId, long userId) {
        PatientProfile profile =
                patientProfileService
                        .findEntityByUserId(userId)
                        .orElseThrow(() -> new VillagePatientProfileMissingException(userId));

        Instant now = Instant.now();

        lock.lock();
        try {
            PlayerState existing = members.get(userId);

            if (existing == null) {
                if (members.size() >= properties.roomCapacity()) {
                    throw new VillageRoomFullException(properties.roomCapacity());
                }
                PlayerState newMember =
                        new PlayerState(
                                userId,
                                profile.getId(),
                                profile.getNickname(),
                                DEFAULT_TEXTURE_KEY,
                                DEFAULT_X_RATIO,
                                DEFAULT_Y_RATIO,
                                DEFAULT_DIR,
                                sessionId,
                                now);
                members.put(userId, newMember);
                sessionIndex.put(sessionId, userId);
                return new JoinResult(JoinOutcome.JOINED, newMember, Optional.empty());
            }

            // latest-wins: 기존 세션 ID 무효화 + 위치/외형 유지하며 세션만 교체
            sessionIndex.remove(existing.sessionId());
            PlayerState replaced = existing.withSession(sessionId, now);
            members.put(userId, replaced);
            sessionIndex.put(sessionId, userId);
            return new JoinResult(JoinOutcome.REPLACED, replaced, Optional.of(existing));
        } finally {
            lock.unlock();
        }
    }

    /**
     * 세션 disconnect 시 호출. 해당 세션이 여전히 룸의 {@code userId} 를 점유 중이면 제거.
     *
     * <p>race 방지: 이미 latest-wins 로 새 세션이 점유한 멤버는 제거하지 않는다 (옛 세션의 늦은 disconnect 이벤트가 새 세션의 presence
     * 를 지우지 않도록).
     */
    public Optional<PlayerState> leaveBySession(String sessionId) {
        lock.lock();
        try {
            Long userId = sessionIndex.remove(sessionId);
            if (userId == null) {
                return Optional.empty();
            }
            PlayerState member = members.get(userId);
            if (member != null && sessionId.equals(member.sessionId())) {
                members.remove(userId);
                lastEmoteByUserId.remove(userId);
                return Optional.of(member);
            }
            return Optional.empty();
        } finally {
            lock.unlock();
        }
    }

    /**
     * 이모티콘 발신 시도. throttle 통과 + 멤버 존재 시 멤버 반환 (호출자가 broadcast). throttle 또는 미존재 시 빈 Optional.
     *
     * <p>"미존재" 는 latest-wins 로 evict 된 옛 세션의 늦은 emote 패킷 케이스 — 조용히 drop.
     */
    public Optional<PlayerState> registerEmote(long userId, Instant now) {
        lock.lock();
        try {
            PlayerState member = members.get(userId);
            if (member == null) {
                return Optional.empty();
            }
            Instant last = lastEmoteByUserId.get(userId);
            if (last != null && Duration.between(last, now).compareTo(EMOTE_THROTTLE) < 0) {
                return Optional.empty();
            }
            lastEmoteByUserId.put(userId, now);
            return Optional.of(member);
        } finally {
            lock.unlock();
        }
    }

    /**
     * 위치 패킷 수신 시 호출. 멤버가 있으면 위치/방향/lastSeen 을 갱신해 반환, 없으면 빈 Optional.
     *
     * <p>"없음" 은 latest-wins 로 evict 된 옛 세션이 늦은 position 패킷을 보내는 경우 — 이 경우 갱신/브로드캐스트하지 않는다.
     */
    public Optional<PlayerState> updatePosition(long userId, double x, double y, String dir) {
        Instant now = Instant.now();
        lock.lock();
        try {
            PlayerState existing = members.get(userId);
            if (existing == null) {
                return Optional.empty();
            }
            PlayerState updated = existing.withPosition(x, y, dir, now);
            members.put(userId, updated);
            return Optional.of(updated);
        } finally {
            lock.unlock();
        }
    }

    /** 좀비 정리. {@code idle-disconnect-seconds} 초과한 멤버 전부 제거 후 반환. */
    public Collection<PlayerState> evictIdle(Instant now) {
        Duration threshold = Duration.ofSeconds(properties.idleDisconnectSeconds());
        lock.lock();
        try {
            List<PlayerState> evicted = new ArrayList<>();
            Iterator<Map.Entry<Long, PlayerState>> it = members.entrySet().iterator();
            while (it.hasNext()) {
                PlayerState member = it.next().getValue();
                if (Duration.between(member.lastSeen(), now).compareTo(threshold) > 0) {
                    it.remove();
                    sessionIndex.remove(member.sessionId());
                    evicted.add(member);
                }
            }
            return evicted;
        } finally {
            lock.unlock();
        }
    }

    public Collection<PlayerState> members() {
        return List.copyOf(members.values());
    }

    public Optional<PlayerState> findByUserId(long userId) {
        return Optional.ofNullable(members.get(userId));
    }

    public Optional<PlayerState> findBySessionId(String sessionId) {
        Long userId = sessionIndex.get(sessionId);
        return userId == null ? Optional.empty() : findByUserId(userId);
    }

    public int size() {
        return members.size();
    }
}
