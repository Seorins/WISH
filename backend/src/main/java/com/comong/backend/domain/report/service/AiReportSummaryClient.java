package com.comong.backend.domain.report.service;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import com.comong.backend.domain.report.config.AiReportSummaryProperties;
import com.comong.backend.domain.report.dto.WeeklyReportAiSummaryResponse;

/**
 * AI 서버의 {@code POST /report/summarize} 어댑터. 동기 호출 — 보호자 GET 응답을 대기하기 때문.
 *
 * <p>실패(타임아웃/5xx/파싱 오류/AI 비활성)는 모두 로깅만 하고 {@link WeeklyReportAiSummaryResponse#fallback()} 으로
 * 복구한다. 리포트 화면 자체는 항상 노출되어야 하므로 예외를 위로 던지지 않는다.
 */
@Component
public class AiReportSummaryClient {

    private static final Logger log = LoggerFactory.getLogger(AiReportSummaryClient.class);

    private final RestClient restClient;
    private final AiReportSummaryProperties properties;

    public AiReportSummaryClient(
            @Qualifier("aiReportSummaryRestClient") RestClient restClient,
            AiReportSummaryProperties properties) {
        this.restClient = restClient;
        this.properties = properties;
    }

    public WeeklyReportAiSummaryResponse summarize(Map<String, Object> payload) {
        if (!properties.isEnabled()) {
            log.warn("AI report summary disabled (no base-url) — returning fallback");
            return WeeklyReportAiSummaryResponse.fallback();
        }

        Map<String, Object> body;
        try {
            body =
                    restClient
                            .post()
                            .uri("/report/summarize")
                            .body(payload)
                            .retrieve()
                            .body(new ParameterizedTypeReference<>() {});
        } catch (Exception e) {
            log.warn("AI report summary call failed: {}", e.getMessage());
            return WeeklyReportAiSummaryResponse.fallback();
        }

        if (body == null) {
            log.warn("AI report summary returned null body");
            return WeeklyReportAiSummaryResponse.fallback();
        }

        return mapToResponse(body);
    }

    @SuppressWarnings("unchecked")
    private static WeeklyReportAiSummaryResponse mapToResponse(Map<String, Object> body) {
        List<String> summary = toStringList(body.get("summary"));
        List<String> activity = toStringList(body.get("activity_observations"));
        List<String> emotion = toStringList(body.get("emotion_observations"));
        Object connectionRaw = body.get("connection");
        String connection =
                (connectionRaw instanceof String s && !s.isBlank()) ? s : null;
        Object suggestionRaw = body.get("suggestion");
        String suggestion = suggestionRaw instanceof String s ? s : "";
        boolean isFallback = Boolean.TRUE.equals(body.get("is_fallback"));

        if (summary.isEmpty() || suggestion.isBlank()) {
            // AI 측에서도 fallback 처리 안 된 비정상 응답 → 보수적으로 fallback 으로 통일.
            log.warn("AI report summary missing required fields, using fallback");
            return WeeklyReportAiSummaryResponse.fallback();
        }
        return new WeeklyReportAiSummaryResponse(
                summary, activity, emotion, connection, suggestion, isFallback);
    }

    @SuppressWarnings("unchecked")
    private static List<String> toStringList(Object value) {
        if (value instanceof List<?> raw) {
            return raw.stream().filter(v -> v instanceof String).map(v -> (String) v).toList();
        }
        return List.of();
    }
}
