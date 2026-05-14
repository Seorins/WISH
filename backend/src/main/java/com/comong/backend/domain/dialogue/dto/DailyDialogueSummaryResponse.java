package com.comong.backend.domain.dialogue.dto;

import java.time.LocalDate;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 보호자 페이지의 *오늘 종합* 요약 — 점수 없음, 응답 톤 분포 + 시그널 + 주제 + NPC + 정성 요약 텍스트.
 *
 * <p>임상 진단으로 오인될 수 있는 정량 점수는 의도적으로 제공하지 않는다 (설계 문서 v3 섹션 2).
 */
public record DailyDialogueSummaryResponse(
        @Schema(description = "조회 일자 (KST)", example = "2026-05-14") LocalDate date,
        @Schema(description = "정성 관찰 요약 문단 (템플릿 기반, AI 미사용)") String summaryText,
        @Schema(description = "응답 톤 분포 (긍정/보통/부정 카운트)")
                ValenceDistributionResponse valenceDistribution,
        @Schema(description = "오늘 보인 감정 신호") List<DialogueSignalResponse> signals,
        @Schema(description = "주제 태그 union") List<String> topics,
        @Schema(description = "오늘 만난 NPC + 다룬 도메인 + 빈도") List<NpcVisitedResponse> npcsVisited,
        @Schema(description = "오늘 진행한 세션 개수") int sessionCount) {}
