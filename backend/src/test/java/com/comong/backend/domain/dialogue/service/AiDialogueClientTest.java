package com.comong.backend.domain.dialogue.service;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import com.comong.backend.domain.dialogue.config.AiDialogueProperties;
import com.comong.backend.domain.dialogue.entity.DialogueSession;
import com.comong.backend.domain.dialogue.entity.DialogueTurn;

/**
 * {@link AiDialogueClient} 단위 테스트. RestClient 자체의 HTTP 호출은 통합 테스트에서 다루며, 본 테스트는 호출 자체를 스킵하는 가드 두
 * 가지만 검증한다 — 그렇지 않으면 RestClient 의 fluent chain 을 모킹하는 boilerplate 가 가치 대비 너무 크다.
 */
class AiDialogueClientTest {

    private final RestClient restClient = mock(RestClient.class);

    @Test
    @DisplayName("base-url 미설정이면 RestClient 호출 없이 즉시 스킵")
    void skipsWhenBaseUrlEmpty() {
        AiDialogueClient client = new AiDialogueClient(restClient, new AiDialogueProperties("", 5));

        client.embedSessionAsync(mock(DialogueSession.class), List.of(mock(DialogueTurn.class)));

        verifyNoInteractions(restClient);
    }

    @Test
    @DisplayName("turns 가 빈 리스트면 호출 없이 스킵")
    void skipsWhenTurnsEmpty() {
        AiDialogueClient client =
                new AiDialogueClient(
                        restClient, new AiDialogueProperties("http://ai-test:8001/api/v1", 5));
        DialogueSession session = mock(DialogueSession.class);
        when(session.getId()).thenReturn(42L);

        client.embedSessionAsync(session, List.of());

        verifyNoInteractions(restClient);
    }

    @Test
    @DisplayName("null turns 도 스킵 — 호출자 방어 보강")
    void skipsWhenTurnsNull() {
        AiDialogueClient client =
                new AiDialogueClient(
                        restClient, new AiDialogueProperties("http://ai-test:8001/api/v1", 5));
        DialogueSession session = mock(DialogueSession.class);
        when(session.getId()).thenReturn(7L);

        client.embedSessionAsync(session, null);

        verifyNoInteractions(restClient);
    }
}
