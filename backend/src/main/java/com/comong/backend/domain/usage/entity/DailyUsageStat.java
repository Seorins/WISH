package com.comong.backend.domain.usage.entity;

import java.time.LocalDate;
import java.util.Objects;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 일별 컨텐츠 사용량 집계 row. 매일 KST 01:00 배치가 source 5종 ({@code user_login_session} / {@code artworks} /
 * {@code music_result} / {@code taekwondo_session} / {@code exercise_session}) 에서 전일 데이터를 UPSERT
 * 한다.
 *
 * <p>의미적 PK 는 ({@code stat_date}, {@code content_type}) 조합이지만 JPA 보일러플레이트를 줄이려고 surrogate id +
 * UNIQUE 제약으로 처리. 비즈니스 로직 측면에서는 unique key 가 사실상 PK 처럼 동작.
 *
 * <p>동시성: 배치는 single-threaded scheduler 가 호출하므로 동일 (date, type) 에 대한 race 는 발생하지 않는다. 수동 재실행이 겹치는
 * 경우에도 UNIQUE 제약이 안전망.
 */
@Entity
@Getter
@Table(
        name = "daily_usage_stat",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uk_daily_usage_stat_date_type",
                        columnNames = {"stat_date", "content_type"}))
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DailyUsageStat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "stat_date", nullable = false, updatable = false)
    private LocalDate statDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "content_type", nullable = false, length = 20, updatable = false)
    private ContentType contentType;

    @Column(name = "total_seconds", nullable = false)
    private long totalSeconds;

    @Column(name = "unique_patients", nullable = false)
    private int uniquePatients;

    @Builder
    private DailyUsageStat(
            LocalDate statDate, ContentType contentType, long totalSeconds, int uniquePatients) {
        this.statDate = Objects.requireNonNull(statDate, "statDate must not be null");
        this.contentType = Objects.requireNonNull(contentType, "contentType must not be null");
        if (totalSeconds < 0) {
            throw new IllegalArgumentException("totalSeconds must not be negative");
        }
        if (uniquePatients < 0) {
            throw new IllegalArgumentException("uniquePatients must not be negative");
        }
        this.totalSeconds = totalSeconds;
        this.uniquePatients = uniquePatients;
    }

    /**
     * UPSERT 시 update 부분에 사용. 같은 (stat_date, content_type) 으로 재집계가 들어오면 새 값으로 덮어쓴다 — 배치 재실행 안전성 보장
     * (상위 도메인 source 가 늦게 들어온 경우에도 다음 배치에서 정합).
     */
    public void overwriteAggregates(long totalSeconds, int uniquePatients) {
        if (totalSeconds < 0) {
            throw new IllegalArgumentException("totalSeconds must not be negative");
        }
        if (uniquePatients < 0) {
            throw new IllegalArgumentException("uniquePatients must not be negative");
        }
        this.totalSeconds = totalSeconds;
        this.uniquePatients = uniquePatients;
    }
}
