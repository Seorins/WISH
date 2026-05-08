package com.comong.backend.domain.usage.repository;

import java.time.LocalDate;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.comong.backend.domain.usage.entity.ContentType;
import com.comong.backend.domain.usage.entity.DailyUsageStat;

public interface DailyUsageStatRepository extends JpaRepository<DailyUsageStat, Long> {

    /** 배치가 UPSERT 분기, 통계 조회 API 가 lookup 시 사용. UNIQUE 제약 (date, type) 으로 0..1 row. */
    Optional<DailyUsageStat> findByStatDateAndContentType(
            LocalDate statDate, ContentType contentType);

    /**
     * 미술 일별 증가분 계산용 — 어제까지 누적된 ART 합. 배치가 {@code SUM(artworks.play_duration_seconds)} 와 diff 해서 전일
     * 증가분을 도출한다.
     */
    @Query(
            "select coalesce(sum(s.totalSeconds), 0) from DailyUsageStat s "
                    + "where s.contentType = :contentType and s.statDate < :before")
    long sumTotalSecondsByContentTypeBefore(ContentType contentType, LocalDate before);
}
