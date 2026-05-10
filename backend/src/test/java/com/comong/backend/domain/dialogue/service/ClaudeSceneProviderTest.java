package com.comong.backend.domain.dialogue.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.comong.backend.domain.dialogue.dto.SceneResponse;
import com.comong.backend.domain.dialogue.entity.DialogueSession;
import com.comong.backend.domain.dialogue.entity.DialogueTurn;
import com.comong.backend.domain.dialogue.entity.DialogueTurnGeneratedBy;
import com.comong.backend.domain.dialogue.service.ClaudeClient.ClaudeChoice;
import com.comong.backend.domain.dialogue.service.ClaudeClient.ClaudeSceneResult;

/**
 * {@link ClaudeSceneProvider} 단위 테스트. {@link ClaudeClient} 를 모킹해 비즈니스 검증 로직을 격리 검증.
 *
 * <p>HTTP 호출이나 GMS 응답 파싱은 본 테스트 범위 밖.
 */
class ClaudeSceneProviderTest {

    private ClaudeClient claudeClient;
    private ClaudeSceneProvider provider;
    private DialogueSession session;

    @BeforeEach
    void setUp() {
        claudeClient = mock(ClaudeClient.class);
        provider = new ClaudeSceneProvider(claudeClient);
        session = mock(DialogueSession.class);
        when(session.getId()).thenReturn(42L);
    }

    @Test
    @DisplayName("정상 응답 → CLAUDE 출처의 SceneResponse 변환")
    void happyPath_returnsClaudeSceneResponse() {
        ClaudeSceneResult raw =
                new ClaudeSceneResult(
                        "무엇이 가장 걱정되니?",
                        List.of(
                                new ClaudeChoice("worry_pain", "아픈 게 걱정돼요"),
                                new ClaudeChoice("worry_family", "가족이 걱정돼요")),
                        false);
        when(claudeClient.generateNextScene(anyString(), anyString())).thenReturn(Optional.of(raw));

        Optional<SceneResponse> result = provider.nextScene(session, List.of());

        assertThat(result).isPresent();
        SceneResponse scene = result.get();
        assertThat(scene.questionText()).isEqualTo("무엇이 가장 걱정되니?");
        assertThat(scene.choices()).hasSize(2);
        assertThat(scene.choices().get(0).choiceIntentId()).isEqualTo("worry_pain");
        assertThat(scene.secondaryAction()).isNull();
        assertThat(scene.shouldEndSession()).isFalse();
        assertThat(scene.generatedBy()).isEqualTo(DialogueTurnGeneratedBy.CLAUDE);
    }

    @Test
    @DisplayName("ClaudeClient 가 empty 반환 시 (키 미설정 / HTTP 실패) → empty")
    void claudeClientEmpty_returnsEmpty() {
        when(claudeClient.generateNextScene(anyString(), anyString())).thenReturn(Optional.empty());

        Optional<SceneResponse> result = provider.nextScene(session, List.of());

        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("questionText 가 30자 초과 → empty")
    void questionTextTooLong_returnsEmpty() {
        String longQ = "가".repeat(31);
        ClaudeSceneResult raw =
                new ClaudeSceneResult(longQ, List.of(new ClaudeChoice("ok", "괜찮아요")), false);
        when(claudeClient.generateNextScene(anyString(), anyString())).thenReturn(Optional.of(raw));

        assertThat(provider.nextScene(session, List.of())).isEmpty();
    }

    @Test
    @DisplayName("questionText 에 금지어(우울증) 포함 → empty")
    void questionTextWithForbiddenTerm_returnsEmpty() {
        ClaudeSceneResult raw =
                new ClaudeSceneResult(
                        "오늘 우울증 상태야?", List.of(new ClaudeChoice("ok", "괜찮아요")), false);
        when(claudeClient.generateNextScene(anyString(), anyString())).thenReturn(Optional.of(raw));

        assertThat(provider.nextScene(session, List.of())).isEmpty();
    }

    @Test
    @DisplayName("choices 가 비어있음 → empty (PDF: 1~3개)")
    void emptyChoices_returnsEmpty() {
        ClaudeSceneResult raw = new ClaudeSceneResult("괜찮니?", List.of(), false);
        when(claudeClient.generateNextScene(anyString(), anyString())).thenReturn(Optional.of(raw));

        assertThat(provider.nextScene(session, List.of())).isEmpty();
    }

    @Test
    @DisplayName("choices 가 4개 이상 → empty (PDF: 1~3개)")
    void tooManyChoices_returnsEmpty() {
        ClaudeSceneResult raw =
                new ClaudeSceneResult(
                        "괜찮니?",
                        List.of(
                                new ClaudeChoice("a", "괜찮아요"),
                                new ClaudeChoice("b", "걱정돼요"),
                                new ClaudeChoice("c", "힘들어요"),
                                new ClaudeChoice("d", "외로워요")),
                        false);
        when(claudeClient.generateNextScene(anyString(), anyString())).thenReturn(Optional.of(raw));

        assertThat(provider.nextScene(session, List.of())).isEmpty();
    }

    @Test
    @DisplayName("choice text 가 18자 초과 → empty")
    void choiceTextTooLong_returnsEmpty() {
        String longText = "긴".repeat(19);
        ClaudeSceneResult raw =
                new ClaudeSceneResult("괜찮니?", List.of(new ClaudeChoice("intent", longText)), false);
        when(claudeClient.generateNextScene(anyString(), anyString())).thenReturn(Optional.of(raw));

        assertThat(provider.nextScene(session, List.of())).isEmpty();
    }

    @Test
    @DisplayName("choice text 에 금지어(진단) 포함 → empty")
    void choiceTextWithForbiddenTerm_returnsEmpty() {
        ClaudeSceneResult raw =
                new ClaudeSceneResult(
                        "괜찮니?", List.of(new ClaudeChoice("intent", "진단 받았어요")), false);
        when(claudeClient.generateNextScene(anyString(), anyString())).thenReturn(Optional.of(raw));

        assertThat(provider.nextScene(session, List.of())).isEmpty();
    }

    @Test
    @DisplayName("rest_today 가 choices 에 등장 → empty (PDF: 후속 질문에서 금지)")
    void restTodayInChoices_returnsEmpty() {
        ClaudeSceneResult raw =
                new ClaudeSceneResult(
                        "괜찮니?",
                        List.of(
                                new ClaudeChoice("ok", "괜찮아요"),
                                new ClaudeChoice("rest_today", "오늘은 쉬고 싶어요")),
                        false);
        when(claudeClient.generateNextScene(anyString(), anyString())).thenReturn(Optional.of(raw));

        assertThat(provider.nextScene(session, List.of())).isEmpty();
    }

    @Test
    @DisplayName("turns 가 있을 때 user message 에 직전 선택을 echo (전송 내용 검증은 prompt 확인용)")
    void buildUserMessage_includesPreviousTurns() {
        DialogueTurn turn = mock(DialogueTurn.class);
        when(turn.getQuestionText()).thenReturn("오늘 기분은 어떠니?");
        when(turn.getChoiceText()).thenReturn("걱정돼요");
        when(turn.getChoiceIntentId()).thenReturn("mood_worried");

        ClaudeSceneResult raw =
                new ClaudeSceneResult(
                        "무엇이 가장 걱정되니?",
                        List.of(new ClaudeChoice("worry_pain", "아픈 게 걱정돼요")),
                        false);
        when(claudeClient.generateNextScene(anyString(), anyString())).thenReturn(Optional.of(raw));

        Optional<SceneResponse> result = provider.nextScene(session, List.of(turn));

        assertThat(result).isPresent();
        // user message 의 정확한 검증은 prompt-snapshot 테스트로 분리 예정 — 여기선 호출 자체와 변환만 확인
    }

    @Test
    @DisplayName("ClaudeSceneProvider 는 호출자가 turns 를 빈 list 로 줘도 동작")
    void emptyTurns_stillCallsClaudeAndReturnsScene() {
        ClaudeSceneResult raw =
                new ClaudeSceneResult(
                        "오늘 기분은 어떠니?", List.of(new ClaudeChoice("mood_okay", "괜찮아요")), false);
        when(claudeClient.generateNextScene(anyString(), anyString())).thenReturn(Optional.of(raw));

        Optional<SceneResponse> result = provider.nextScene(session, List.of());

        assertThat(result).isPresent();
        verify(claudeClient, times(1)).generateNextScene(anyString(), anyString());
    }
}
