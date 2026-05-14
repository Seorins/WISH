package com.comong.backend.domain.dialogue.service;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import com.comong.backend.domain.dialogue.config.AiDialogueProperties;
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
 *
 * <p>주의: 현재 {@link DialogueTurn} 엔티티에 NPC 응답 컬럼이 없어 임베딩 페이로드의 {@code npc_response} 는 빈 문자열로 보낸다.
 * 임베딩 콘텐츠는 질문 + 아이 발화로만 구성되며, RAG 검색의 의미적 매칭은 동작하지만 응답 텍스트는 컨텍스트에 포함되지 않는다. 추후 컬럼 추가 작업에서 보강 예정.
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
                            .body(new org.springframework.core.ParameterizedTypeReference<>() {});
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

    private static Map<String, Object> toTurnPayload(DialogueTurn turn) {
        return Map.of(
                "question_text", turn.getQuestionText(),
                "choice_text", turn.getChoiceText(),
                "npc_response", "");
    }
}
