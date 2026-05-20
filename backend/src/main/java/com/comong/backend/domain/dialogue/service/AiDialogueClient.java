package com.comong.backend.domain.dialogue.service;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import com.comong.backend.domain.dialogue.config.AiDialogueProperties;
import com.comong.backend.domain.dialogue.catalog.model.ChoiceTone;
import com.comong.backend.domain.dialogue.catalog.model.ChoiceValence;
import com.comong.backend.domain.dialogue.entity.DialogueTurn;
import com.comong.backend.domain.dialogue.entity.NpcName;

/**
 * AI 서버 RAG 어댑터. 세션 종료 시 대화 내용을 환아별 벡터 DB에 임베딩하도록 트리거한다 (S14P31E103-788).
 *
 * <p>호출은 {@code @Async} 로 fire-and-forget — 사용자의 세션 종료 응답을 막지 않는다. 모든 예외(connect 실패, timeout, 5xx,
 * AI 측 success=false 응답)는 로깅만 하고 swallow 한다.
 *
 * <p>인자는 모두 primitive/value 만 받는다 — 비동기 스레드는 호출자 트랜잭션 밖에서 실행되므로 JPA 엔티티(lazy 연관)를 직접 들고 들어오면 {@link
 * org.hibernate.LazyInitializationException} 위험. 호출자가 트랜잭션 안에서 미리 unpack 해 넘긴다.
 */
@Component
public class AiDialogueClient {

    private static final Logger log = LoggerFactory.getLogger(AiDialogueClient.class);

    private final RestClient restClient;
    private final AiDialogueProperties properties;

    public AiDialogueClient(
            @Qualifier("aiDialogueRestClient") RestClient restClient,
            AiDialogueProperties properties) {
        this.restClient = restClient;
        this.properties = properties;
    }

    /**
     * 세션 종료 트랜잭션 커밋 직후 호출. AI 서버 {@code POST /dialogue/embed-session} 으로 turns 를 보내 환아별 벡터 DB 에
     * 적재한다.
     *
     * <p>{@code @Async} 빈 외부 호출 시점에 Spring proxy 가 작동하여 별도 스레드로 위임. 호출자는 즉시 반환된다.
     */
    @Async("aiDialogueTaskExecutor")
    public void embedSessionAsync(
            long patientProfileId, long sessionId, NpcName npcName, List<DialogueTurn> turns) {
        if (!properties.isEnabled()) {
            log.debug("AI dialogue disabled (no base-url) — skip embed for session={}", sessionId);
            return;
        }
        if (turns == null || turns.isEmpty()) {
            log.debug("Empty turns — skip embed for session={}", sessionId);
            return;
        }

        Map<String, Object> body =
                Map.of(
                        "patient_profile_id",
                        patientProfileId,
                        "session_id",
                        sessionId,
                        "npc_name",
                        npcName.name(),
                        "turns",
                        turns.stream().map(AiDialogueClient::toTurnPayload).toList());

        try {
            Map<String, Object> response =
                    restClient
                            .post()
                            .uri("/dialogue/embed-session")
                            .body(body)
                            .retrieve()
                            .body(new ParameterizedTypeReference<>() {});
            Object success = response != null ? response.get("success") : null;
            if (Boolean.TRUE.equals(success)) {
                log.info("AI embed-session ok session={} turns={}", sessionId, turns.size());
            } else {
                log.warn(
                        "AI embed-session returned non-success session={} body={}",
                        sessionId,
                        response);
            }
        } catch (Exception e) {
            log.warn(
                    "AI embed-session call failed session={} reason={}", sessionId, e.getMessage());
        }
    }

    public Optional<EmotionSummaryResult> summarizeEmotion(
            long patientProfileId, long sessionId, NpcName npcName, List<DialogueTurn> turns) {
        if (!properties.isEnabled()) {
            log.debug("AI dialogue disabled (no base-url) - skip emotion summary for session={}", sessionId);
            return Optional.empty();
        }
        if (turns == null || turns.isEmpty()) {
            log.debug("Empty turns - skip emotion summary for session={}", sessionId);
            return Optional.empty();
        }

        Map<String, Object> body =
                Map.of(
                        "patient_profile_id",
                        patientProfileId,
                        "session_id",
                        sessionId,
                        "npc_name",
                        npcName.name(),
                        "turns",
                        turns.stream().map(AiDialogueClient::toTurnPayload).toList());

        try {
            Map<String, Object> response =
                    restClient
                            .post()
                            .uri("/dialogue/emotion-summary")
                            .body(body)
                            .retrieve()
                            .body(new ParameterizedTypeReference<>() {});
            Object success = response != null ? response.get("success") : null;
            if (Boolean.FALSE.equals(success)) {
                log.warn("AI emotion-summary returned failure session={} body={}", sessionId, response);
                return Optional.empty();
            }
            return parseEmotionSummary(sessionId, response);
        } catch (Exception e) {
            log.warn("AI emotion-summary call failed session={} reason={}", sessionId, e.getMessage());
            return Optional.empty();
        }
    }

    private static Map<String, Object> toTurnPayload(DialogueTurn turn) {
        return Map.of(
                "question_text",
                turn.getQuestionText(),
                "choice_text",
                turn.getChoiceText(),
                "npc_response",
                turn.getNpcResponseText() == null ? "" : turn.getNpcResponseText());
    }

    private static Optional<EmotionSummaryResult> parseEmotionSummary(
            long sessionId, Map<String, Object> response) {
        if (response == null) {
            return Optional.empty();
        }
        ChoiceValence valence =
                parseEnum(ChoiceValence.class, response.get("overall_valence"));
        ChoiceTone tone = parseEnum(ChoiceTone.class, response.get("tone"));
        Short intensity = parseIntensity(response.get("intensity"));
        if (valence == null || tone == null || intensity == null) {
            log.warn("AI emotion-summary invalid schema session={} body={}", sessionId, response);
            return Optional.empty();
        }
        return Optional.of(
                new EmotionSummaryResult(
                        valence,
                        tone,
                        intensity,
                        stringList(response.get("concern_flags")),
                        stringList(response.get("protective_factors")),
                        stringValue(response.get("guardian_message")),
                        Boolean.TRUE.equals(response.get("is_fallback"))));
    }

    private static <E extends Enum<E>> E parseEnum(Class<E> enumType, Object value) {
        if (value == null) {
            return null;
        }
        try {
            return Enum.valueOf(enumType, value.toString().trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static Short parseIntensity(Object value) {
        if (value instanceof Number number) {
            int parsed = number.intValue();
            return parsed >= 0 && parsed <= 3 ? (short) parsed : null;
        }
        if (value instanceof String text) {
            try {
                int parsed = Integer.parseInt(text.trim());
                return parsed >= 0 && parsed <= 3 ? (short) parsed : null;
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private static List<String> stringList(Object value) {
        if (!(value instanceof List<?> list)) {
            return List.of();
        }
        return list.stream().map(AiDialogueClient::stringValue).filter(s -> !s.isBlank()).toList();
    }

    private static String stringValue(Object value) {
        return value == null ? "" : value.toString();
    }

    public record EmotionSummaryResult(
            ChoiceValence overallValence,
            ChoiceTone tone,
            short intensity,
            List<String> concernFlags,
            List<String> protectiveFactors,
            String guardianMessage,
            boolean fallback) {}
}
