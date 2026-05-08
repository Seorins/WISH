package com.comong.backend.domain.usage.service;

import java.time.LocalDate;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.comong.backend.domain.usage.entity.ContentType;
import com.comong.backend.domain.usage.entity.DailyUsageStat;
import com.comong.backend.domain.usage.repository.DailyUsageStatRepository;
import com.comong.backend.domain.usage.repository.UsageAggregationQuery;
import com.comong.backend.domain.usage.repository.UsageAggregationQuery.AggregateResult;
import com.comong.backend.domain.usage.repository.UsageAggregationQuery.ArtAggregate;

import lombok.RequiredArgsConstructor;

/**
 * 5종 source 에서 전일 활동량을 뽑아 {@code daily_usage_stat} 에 적재하는 일별 배치.
 *
 * <p>매일 KST 01:00 에 {@link com.comong.backend.domain.usage.scheduler.DailyUsageStatScheduler} 가
 * {@link #aggregateForDate(LocalDate)} 를 호출한다. 메서드 자체는 임의 날짜를 받아 처리할 수 있어 수동 재실행/백필도 가능 (idempotent
 * UPSERT — 같은 (date, type) 행 있으면 덮어쓴다).
 *
 * <p>ART 의 일별 증가분 계산이 다른 컨텐츠와 다르다 — {@code artworks.play_duration_seconds} 는 작품별 누적이라 "전일 증가분" 을 직접
 * 못 뽑는다. (현재 시점의 ART 누적합) - (전일 이전 daily_usage_stat 에 누적된 ART 합) 으로 diff 를 구한다. 배치 실행 시점 (D 01:00)
 * 에 D-1 분을 처리하면 D 의 0~1시 활동이 D-1 분에 섞여 들어가는 1시간 phase shift 가 생기지만, 누적 합 측면에서는 일관되며 사용자가 보는 일별
 * 그래프에는 무시 가능한 영향이다.
 */
@Service
@RequiredArgsConstructor
public class DailyUsageStatBatchService {

    private static final Logger log = LoggerFactory.getLogger(DailyUsageStatBatchService.class);

    private final DailyUsageStatRepository dailyUsageStatRepository;
    private final UsageAggregationQuery usageAggregationQuery;

    /** 지정 날짜에 대한 5종 컨텐츠 집계를 모두 UPSERT. 배치 단일 트랜잭션 — 일부 성공/일부 실패 상태 방지. */
    @Transactional
    public void aggregateForDate(LocalDate statDate) {
        log.info("Daily usage stat aggregation start: statDate={}", statDate);

        AggregateResult login = usageAggregationQuery.aggregateLogin(statDate);
        upsert(statDate, ContentType.LOGIN, login.totalSeconds(), login.uniquePatients());

        AggregateResult music = usageAggregationQuery.aggregateMusic(statDate);
        upsert(statDate, ContentType.MUSIC, music.totalSeconds(), music.uniquePatients());

        AggregateResult taekwondo = usageAggregationQuery.aggregateTaekwondo(statDate);
        upsert(
                statDate,
                ContentType.TAEKWONDO,
                taekwondo.totalSeconds(),
                taekwondo.uniquePatients());

        AggregateResult gymnastics = usageAggregationQuery.aggregateGymnastics(statDate);
        upsert(
                statDate,
                ContentType.GYMNASTICS,
                gymnastics.totalSeconds(),
                gymnastics.uniquePatients());

        // ART: 누적값 - 직전 배치까지의 누적 합 → 일별 증가분
        ArtAggregate art = usageAggregationQuery.aggregateArtCumulativeAndUnique(statDate);
        long priorArtTotal =
                dailyUsageStatRepository.sumTotalSecondsByContentTypeBefore(
                        ContentType.ART, statDate);
        long artIncrement = Math.max(0L, art.totalCumulative() - priorArtTotal);
        upsert(statDate, ContentType.ART, artIncrement, art.uniquePatients());

        log.info("Daily usage stat aggregation done: statDate={}", statDate);
    }

    private void upsert(
            LocalDate statDate, ContentType contentType, long totalSeconds, int uniquePatients) {
        dailyUsageStatRepository
                .findByStatDateAndContentType(statDate, contentType)
                .ifPresentOrElse(
                        existing -> existing.overwriteAggregates(totalSeconds, uniquePatients),
                        () ->
                                dailyUsageStatRepository.save(
                                        DailyUsageStat.builder()
                                                .statDate(statDate)
                                                .contentType(contentType)
                                                .totalSeconds(totalSeconds)
                                                .uniquePatients(uniquePatients)
                                                .build()));
    }
}
