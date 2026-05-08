package com.comong.backend.domain.usage.repository;

import java.time.LocalDate;
import java.time.LocalDateTime;

import jakarta.persistence.EntityManager;

import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;

/**
 * 5종 source 테이블에서 일별 사용량을 SUM 으로 뽑아오는 read-only 쿼리 모음. 배치({@link
 * com.comong.backend.domain.usage.service.DailyUsageStatBatchService}) 와 통계 조회 API (S14P31E103-543)
 * 의 fallback 경로가 공통으로 사용한다.
 *
 * <p>도메인별 repository 가 아닌 별도 컴포넌트로 둔 이유: 5 source 를 묶는 read-side 통합 책임이라 어느 한 도메인에 속하지 않는다.
 * EntityManager 로 native query 를 직접 던져 PostgreSQL 의 {@code EXTRACT(EPOCH ...)} / {@code INTERVAL} /
 * {@code LEAST} 같은 시간 함수를 활용한다.
 *
 * <p>"날짜" 는 JVM TZ 의 {@link LocalDate} 로 받고 [{@code statDate.atStartOfDay()}, {@code
 * statDate.plusDays(1).atStartOfDay()}) LocalDateTime 범위로 비교한다 — source 테이블의 시간 컬럼들 모두 zone 정보 없는
 * {@code TIMESTAMP(6)} 이므로 JVM TZ 일관성에 의존.
 */
@Component
@RequiredArgsConstructor
public class UsageAggregationQuery {

    /** 좀비 세션(`ended_at IS NULL`) 종료 추정에 쓸 grace. heartbeat 끊긴 후 이만큼 지나면 그 시점을 종료로 본다. */
    private static final int ZOMBIE_SESSION_GRACE_MINUTES = 5;

    private final EntityManager em;

    /**
     * LOGIN: {@code user_login_session} 의 전일 활동 시간. 자정 넘긴 세션은 {@code started_at} 의 날짜로 통째 귀속(에픽
     * 결정), {@code ended_at IS NULL} 인 좀비 세션은 {@code LEAST(NOW(), last_heartbeat_at + 5min) -
     * started_at} 으로 duration 추정.
     */
    public AggregateResult aggregateLogin(LocalDate statDate) {
        LocalDateTime start = statDate.atStartOfDay();
        LocalDateTime end = statDate.plusDays(1).atStartOfDay();
        Object[] row =
                (Object[])
                        em.createNativeQuery(
                                        """
                                        SELECT COALESCE(SUM(
                                                  CASE
                                                      WHEN ended_at IS NOT NULL THEN duration_seconds
                                                      ELSE GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (
                                                          LEAST(NOW(), last_heartbeat_at + (INTERVAL '1 minute' * :grace))
                                                          - started_at
                                                      )))::int)
                                                  END
                                              ), 0)::bigint AS total_seconds,
                                              COUNT(DISTINCT patient_profile_id)::int AS unique_patients
                                        FROM user_login_session
                                        WHERE started_at >= :start AND started_at < :end
                                        """)
                                .setParameter("start", start)
                                .setParameter("end", end)
                                .setParameter("grace", ZOMBIE_SESSION_GRACE_MINUTES)
                                .getSingleResult();
        return AggregateResult.from(row);
    }

    public AggregateResult aggregateMusic(LocalDate statDate) {
        LocalDateTime start = statDate.atStartOfDay();
        LocalDateTime end = statDate.plusDays(1).atStartOfDay();
        Object[] row =
                (Object[])
                        em.createNativeQuery(
                                        """
                                        SELECT COALESCE(SUM(played_duration_ms) / 1000, 0)::bigint AS total_seconds,
                                               COUNT(DISTINCT patient_profile_id)::int AS unique_patients
                                        FROM music_result
                                        WHERE played_at >= :start AND played_at < :end
                                        """)
                                .setParameter("start", start)
                                .setParameter("end", end)
                                .getSingleResult();
        return AggregateResult.from(row);
    }

    public AggregateResult aggregateTaekwondo(LocalDate statDate) {
        LocalDateTime start = statDate.atStartOfDay();
        LocalDateTime end = statDate.plusDays(1).atStartOfDay();
        Object[] row =
                (Object[])
                        em.createNativeQuery(
                                        """
                                        SELECT COALESCE(SUM(duration_sec), 0)::bigint AS total_seconds,
                                               COUNT(DISTINCT patient_id)::int AS unique_patients
                                        FROM taekwondo_session
                                        WHERE created_at >= :start AND created_at < :end
                                        """)
                                .setParameter("start", start)
                                .setParameter("end", end)
                                .getSingleResult();
        return AggregateResult.from(row);
    }

    public AggregateResult aggregateGymnastics(LocalDate statDate) {
        LocalDateTime start = statDate.atStartOfDay();
        LocalDateTime end = statDate.plusDays(1).atStartOfDay();
        Object[] row =
                (Object[])
                        em.createNativeQuery(
                                        """
                                        SELECT COALESCE(SUM(duration_sec), 0)::bigint AS total_seconds,
                                               COUNT(DISTINCT patient_id)::int AS unique_patients
                                        FROM exercise_session
                                        WHERE created_at >= :start AND created_at < :end
                                        """)
                                .setParameter("start", start)
                                .setParameter("end", end)
                                .getSingleResult();
        return AggregateResult.from(row);
    }

    /**
     * ART: {@code artworks.play_duration_seconds} 가 작품별 누적 컬럼이라, "전일 증가분" 을 직접 못 뽑는다. 대신 (현재 누적) -
     * (직전 배치까지의 ART 합) 으로 diff 를 구한다 — diff 호출 책임은 {@link
     * com.comong.backend.domain.usage.service.DailyUsageStatBatchService} 에 있고, 본 메서드는 두 컴포넌트를 반환만
     * 한다.
     *
     * @param statDate unique_patients 산출 대상 날짜 (해당일에 작품을 수정한 환자 수)
     */
    public ArtAggregate aggregateArtCumulativeAndUnique(LocalDate statDate) {
        Long totalCumulative =
                ((Number)
                                em.createNativeQuery(
                                                """
                                                SELECT COALESCE(SUM(play_duration_seconds), 0)::bigint
                                                FROM artworks
                                                """)
                                        .getSingleResult())
                        .longValue();

        LocalDateTime start = statDate.atStartOfDay();
        LocalDateTime end = statDate.plusDays(1).atStartOfDay();
        Integer uniquePatients =
                ((Number)
                                em.createNativeQuery(
                                                """
                                                SELECT COUNT(DISTINCT patient_profile_id)::int
                                                FROM artworks
                                                WHERE updated_at >= :start AND updated_at < :end
                                                """)
                                        .setParameter("start", start)
                                        .setParameter("end", end)
                                        .getSingleResult())
                        .intValue();
        return new ArtAggregate(totalCumulative, uniquePatients);
    }

    public record AggregateResult(long totalSeconds, int uniquePatients) {
        static AggregateResult from(Object[] row) {
            return new AggregateResult(((Number) row[0]).longValue(), ((Number) row[1]).intValue());
        }
    }

    /** ART 전용 — totalCumulative 는 전체 누적값(diff 재료), uniquePatients 는 해당일 활동자 수. */
    public record ArtAggregate(long totalCumulative, int uniquePatients) {}
}
