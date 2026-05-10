package com.comong.backend.domain.dialogue.service;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.comong.backend.domain.dialogue.dto.ChoiceResponse;
import com.comong.backend.domain.dialogue.dto.SceneResponse;
import com.comong.backend.domain.dialogue.entity.DialogueSession;
import com.comong.backend.domain.dialogue.entity.DialogueTurn;
import com.comong.backend.domain.dialogue.entity.DialogueTurnGeneratedBy;

import lombok.RequiredArgsConstructor;

/**
 * Claude 가 생성한 다음 장면을 검증해 {@link SceneResponse} 로 변환. 호출자({@link DialogueService})는 본 provider 가 빈
 * 결과를 돌려주면 {@link FallbackSceneProvider} 로 위임한다.
 *
 * <p>책임 경계: HTTP 호출과 tool_use 파싱은 {@link ClaudeClient}, 비즈니스 검증(금지어/길이/choice 수)과 도메인 매핑은 본 클래스.
 *
 * <p>안전 정책: 금지 진단 어휘 / 의료 조언 / 평가 톤이 응답에 등장하면 fallback 으로 넘긴다. PDF 의 "선택 경향만" 표현 원칙을 강제.
 */
@Component
@RequiredArgsConstructor
public class ClaudeSceneProvider {

    private static final Logger log = LoggerFactory.getLogger(ClaudeSceneProvider.class);

    /** 아이 화면에 절대 등장하면 안 되는 진단·평가 어휘 목록. */
    private static final Set<String> FORBIDDEN_TERMS =
            Set.of("우울증", "우울", "불안장애", "위험", "진단", "치료", "죽음", "예후", "심각", "문제 있음", "정상", "비정상");

    private static final int MAX_QUESTION_LENGTH = 30;
    private static final int MAX_CHOICE_TEXT_LENGTH = 18;
    private static final int MAX_INTENT_ID_LENGTH = 64;
    private static final int MIN_CHOICES = 1;
    private static final int MAX_CHOICES = 3;

    private static final String SYSTEM_PROMPT =
            """
            너는 소아암 아동을 위한 게임 속 등대지기 영철의 정서 체크인 보조다.
            너는 심리 진단을 하지 않는다. 우울증·불안장애·위험도·치료 판단·예후를 절대 말하지 않는다.
            너는 의료 조언을 하지 않는다. 아이에게 병의 예후, 죽음, 치료 성공 여부를 묻지 않는다.
            아이는 직접 텍스트를 입력하지 않고 버튼만 누른다. 너는 짧은 질문 1개와 짧은 선택지 1~3개만 만든다.
            questionText 는 30자 이내, 각 choice text 는 18자 이내, choiceIntentId 는 snake_case 짧은 식별자.
            "오늘은 쉬고 싶어요"는 첫 화면에서만 제공된다 — 후속 질문(현재 호출)에는 절대 포함하지 마라.
            금지 표현: 우울증, 불안장애, 위험, 진단, 치료, 죽음, 예후, 정상/비정상, 문제 있음, "빨리 말해", "참아야 해", "긍정적으로 생각해".
            아이가 직전에 고른 선택을 인정하고 자연스럽게 다음 짧은 질문으로 이어간다.
            """;

    private final ClaudeClient claudeClient;

    /**
     * 직전 turn 들을 맥락으로 주고 Claude 가 다음 장면을 만들도록 요청. 검증 통과 시 generatedBy=CLAUDE 의 {@link
     * SceneResponse} 반환, 그 외(키 미설정 / Claude 실패 / 검증 실패)는 empty.
     */
    public Optional<SceneResponse> nextScene(
            DialogueSession session, List<DialogueTurn> turnsAscByStepIndex) {
        String userMessage = buildUserMessage(turnsAscByStepIndex);
        Optional<ClaudeClient.ClaudeSceneResult> result =
                claudeClient.generateNextScene(SYSTEM_PROMPT, userMessage);
        if (result.isEmpty()) {
            return Optional.empty();
        }
        return validate(result.get())
                .map(ClaudeSceneProvider::toSceneResponse)
                .or(
                        () -> {
                            log.warn(
                                    "Claude response failed validation for session {} — falling back",
                                    session.getId());
                            return Optional.empty();
                        });
    }

    private String buildUserMessage(List<DialogueTurn> turns) {
        StringBuilder sb = new StringBuilder("지금까지의 대화 흐름:\n");
        if (turns.isEmpty()) {
            sb.append("(아직 없음 — 첫 후속 질문)\n");
        } else {
            int order = 1;
            for (DialogueTurn t : turns) {
                sb.append(order++)
                        .append(". Q: ")
                        .append(t.getQuestionText())
                        .append(" / A: ")
                        .append(t.getChoiceText())
                        .append(" (intent: ")
                        .append(t.getChoiceIntentId())
                        .append(")\n");
            }
        }
        DialogueTurn last = turns.isEmpty() ? null : turns.get(turns.size() - 1);
        if (last != null) {
            sb.append("\n방금 아이가 \"")
                    .append(last.getChoiceText())
                    .append("\" 를 골랐어. 이 흐름에 자연스럽게 이어지는 짧은 다음 질문과 선택지 1~3개를 만들어줘.");
        } else {
            sb.append("\n첫 후속 질문을 짧게 하나 만들어줘.");
        }
        return sb.toString();
    }

    /** 검증 통과한 ClaudeSceneResult 만 통과시킨다. 실패 시 empty. */
    private Optional<ClaudeClient.ClaudeSceneResult> validate(
            ClaudeClient.ClaudeSceneResult result) {
        String q = result.questionText();
        if (q == null || q.isBlank() || q.length() > MAX_QUESTION_LENGTH || containsForbidden(q)) {
            return Optional.empty();
        }
        List<ClaudeClient.ClaudeChoice> choices = result.choices();
        if (choices == null || choices.size() < MIN_CHOICES || choices.size() > MAX_CHOICES) {
            return Optional.empty();
        }
        for (ClaudeClient.ClaudeChoice c : choices) {
            if (c.choiceIntentId() == null
                    || c.choiceIntentId().isBlank()
                    || c.choiceIntentId().length() > MAX_INTENT_ID_LENGTH
                    || "rest_today".equals(c.choiceIntentId())) {
                return Optional.empty();
            }
            if (c.text() == null
                    || c.text().isBlank()
                    || c.text().length() > MAX_CHOICE_TEXT_LENGTH
                    || containsForbidden(c.text())) {
                return Optional.empty();
            }
        }
        return Optional.of(result);
    }

    private static boolean containsForbidden(String text) {
        for (String term : FORBIDDEN_TERMS) {
            if (text.contains(term)) {
                return true;
            }
        }
        return false;
    }

    private static SceneResponse toSceneResponse(ClaudeClient.ClaudeSceneResult result) {
        List<ChoiceResponse> choices =
                result.choices().stream()
                        .map(c -> ChoiceResponse.of(c.choiceIntentId(), c.text()))
                        .toList();
        return new SceneResponse(
                result.questionText(),
                choices,
                /* secondaryAction= */ null,
                result.shouldEndSession(),
                DialogueTurnGeneratedBy.CLAUDE);
    }
}
