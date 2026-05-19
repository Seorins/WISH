package com.comong.backend.domain.report.service;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import com.comong.backend.domain.report.config.AiReportSummaryProperties;
import com.comong.backend.domain.report.dto.WeeklyReportAiSummaryResponse;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

/**
 * AI 서버의 {@code POST /report/summarize} 어댑터. 동기 호출 — 보호자 GET 응답을 대기하기 때문.
 *
 * <p>실패(타임아웃/5xx/파싱 오류/AI 비활성)는 모두 로깅만 하고 {@link WeeklyReportAiSummaryResponse#fallback()} 으로 복구한다.
 * 리포트 화면 자체는 항상 노출되어야 하므로 예외를 위로 던지지 않는다.
 */
@Component
public class AiReportSummaryClient {

    private static final Logger log = LoggerFactory.getLogger(AiReportSummaryClient.class);

    private final RestClient restClient;
    private final AiReportSummaryProperties properties;
    private final ObjectMapper objectMapper;

    public AiReportSummaryClient(
            @Qualifier("aiReportSummaryRestClient") RestClient restClient,
            AiReportSummaryProperties properties,
            ObjectMapper objectMapper) {
        this.restClient = restClient;
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    public WeeklyReportAiSummaryResponse summarize(Map<String, Object> payload) {
        if (!properties.isEnabled()) {
            log.warn("AI report summary disabled (no base-url) — returning fallback");
            return WeeklyReportAiSummaryResponse.fallback("be:disabled");
        }

        // RestClient.body(Map) 자동 직렬화에서 String 컨버터 매칭 문제로 빈 body 가 전송되는 사례가 있어
        // ObjectMapper 로 미리 JSON 바이트로 만들어 byte[] body 로 보낸다 — ByteArrayHttpMessageConverter
        // 가 항상 매칭되어 신뢰성 있게 전송됨.
        byte[] jsonBytes;
        try {
            jsonBytes = objectMapper.writeValueAsBytes(payload);
        } catch (JacksonException e) {
            log.warn("AI report summary payload serialize failed: {}", e.getMessage());
            return WeeklyReportAiSummaryResponse.fallback("be:serialize-failed:" + e.getMessage());
        }

        Map<String, Object> body;
        try {
            body =
                    restClient
                            .post()
                            .uri("/report/summarize")
                            .contentType(MediaType.APPLICATION_JSON)
                            .body(jsonBytes)
                            .retrieve()
                            .body(new ParameterizedTypeReference<>() {});
        } catch (Exception e) {
            log.warn("AI report summary call failed: {}", e.getMessage());
            return WeeklyReportAiSummaryResponse.fallback(
                    "be:call-failed:" + e.getClass().getSimpleName() + ":" + e.getMessage());
        }

        if (body == null) {
            log.warn("AI report summary returned null body");
            return WeeklyReportAiSummaryResponse.fallback("be:null-body");
        }

        return mapToResponse(body);
    }

    @SuppressWarnings("unchecked")
    private static WeeklyReportAiSummaryResponse mapToResponse(Map<String, Object> body) {
        List<String> summary = toStringList(body.get("summary"));
        List<String> activity = toStringList(body.get("activity_observations"));
        List<String> emotion = toStringList(body.get("emotion_observations"));
        Object connectionRaw = body.get("connection");
        String connection = (connectionRaw instanceof String s && !s.isBlank()) ? s : null;
        Object suggestionRaw = body.get("suggestion");
        String suggestion = suggestionRaw instanceof String s ? s : "";
        boolean isFallback = Boolean.TRUE.equals(body.get("is_fallback"));
        // AI 가 디버그 정보를 넣어 보낸 경우 그대로 통과시킨다.
        Object debugReasonRaw = body.get("debug_reason");
        String debugReason = debugReasonRaw instanceof String s ? s : null;
        Object debugRawRaw = body.get("debug_raw");
        String debugRaw = debugRawRaw instanceof String s ? s : null;

        if (summary.isEmpty() || suggestion.isBlank()) {
            // AI 측에서도 fallback 처리 안 된 비정상 응답 → 보수적으로 fallback 으로 통일.
            log.warn("AI report summary missing required fields, using fallback");
            return WeeklyReportAiSummaryResponse.fallback("be:missing-fields");
        }
        return new WeeklyReportAiSummaryResponse(
                summary,
                activity,
                emotion,
                connection,
                suggestion,
                isFallback,
                debugReason,
                debugRaw);
    }

    @SuppressWarnings("unchecked")
    private static List<String> toStringList(Object value) {
        if (value instanceof List<?> raw) {
            return raw.stream().filter(v -> v instanceof String).map(v -> (String) v).toList();
        }
        return List.of();
    }
}
