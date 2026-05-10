package com.comong.backend.domain.dialogue.service;

import java.util.List;
import java.util.Map;
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
 * <p>책임 경계: HTTP 호출과 tool_use 파싱은 {@link ClaudeClient}, 비즈니스 검증(금지어 / 길이 / choice 수 / 화이트리스트 / 전이규칙
 * / npcResponse)과 도메인 매핑은 본 클래스.
 *
 * <p>안전 4중 방어 (S14P31E103-632):
 *
 * <ol>
 *   <li>system prompt 로 LLM 역할 / 금지 주제 명시
 *   <li>tool_use schema 로 출력 구조 강제
 *   <li>본 클래스의 validate() — 길이 / 금지어 / <b>choiceIntentId 화이트리스트 16종</b> / <b>전이규칙(prevChoice 별
 *       allowedNext)</b>
 *   <li>실패 시 {@link FallbackSceneProvider} 로 안전한 정적 시나리오 위임
 * </ol>
 */
@Component
@RequiredArgsConstructor
public class ClaudeSceneProvider {

    private static final Logger log = LoggerFactory.getLogger(ClaudeSceneProvider.class);

    /** 아이 화면에 절대 등장하면 안 되는 진단·평가 어휘 목록. */
    private static final Set<String> FORBIDDEN_TERMS =
            Set.of("우울증", "우울", "불안장애", "위험", "진단", "치료", "죽음", "예후", "심각", "문제 있음", "정상", "비정상");

    /** 등대지기 대화에서 허용되는 choiceIntentId 16종. 이 외 ID 가 응답에 등장하면 fallback. */
    private static final Set<String> ALLOWED_INTENTS =
            Set.of(
                    "mood_okay",
                    "mood_worried",
                    "mood_hard",
                    "rest_today",
                    "worry_pain",
                    "worry_unknown",
                    "worry_family",
                    "hard_body",
                    "hard_lonely",
                    "hard_angry",
                    "support_family",
                    "support_medical",
                    "support_draw",
                    "action_breathe",
                    "action_draw",
                    "action_tell");

    /**
     * 직전 선택 → 허용되는 다음 choiceIntentId 집합. 화이트리스트 안에 있어도 이 그래프 밖 흐름이면 fallback. 빈 set 은 종료여야 함을 의미.
     */
    private static final Map<String, Set<String>> TRANSITION_RULES =
            Map.ofEntries(
                    Map.entry("mood_okay", Set.of("action_breathe", "action_draw", "action_tell")),
                    Map.entry(
                            "mood_worried", Set.of("worry_pain", "worry_unknown", "worry_family")),
                    Map.entry("mood_hard", Set.of("hard_body", "hard_lonely", "hard_angry")),
                    Map.entry(
                            "worry_pain",
                            Set.of("support_family", "support_medical", "support_draw")),
                    Map.entry(
                            "worry_unknown",
                            Set.of("support_family", "support_medical", "support_draw")),
                    Map.entry(
                            "worry_family",
                            Set.of("support_family", "support_medical", "support_draw")),
                    Map.entry(
                            "hard_body",
                            Set.of("support_family", "support_medical", "support_draw")),
                    Map.entry(
                            "hard_lonely",
                            Set.of("support_family", "support_medical", "support_draw")),
                    Map.entry(
                            "hard_angry",
                            Set.of("support_family", "support_medical", "support_draw")),
                    Map.entry(
                            "action_tell",
                            Set.of("support_family", "support_medical", "support_draw")),
                    // 종료 직전 선택들 — Claude 가 다음 scene 만들면 안 됨 (BE 가 종료 처리)
                    Map.entry("action_breathe", Set.of()),
                    Map.entry("action_draw", Set.of()),
                    Map.entry("support_family", Set.of()),
                    Map.entry("support_medical", Set.of()),
                    Map.entry("support_draw", Set.of()));

    private static final int MAX_QUESTION_LENGTH = 30;
    private static final int MAX_CHOICE_TEXT_LENGTH = 18;
    private static final int MAX_NPC_RESPONSE_LINE_LENGTH = 40;
    private static final int MAX_NPC_RESPONSE_LINES = 2;
    private static final int MIN_CHOICES = 1;
    private static final int MAX_CHOICES = 3;

    private static final String SYSTEM_PROMPT =
            """
            너는 소아암 아동을 위한 게임 속 등대지기 영철의 정서 체크인 보조다.
            너는 심리 진단을 하지 않는다. 우울증·불안장애·위험도·치료 판단·예후를 절대 말하지 않는다.
            너는 의료 조언을 하지 않는다. 아이에게 병의 예후, 죽음, 치료 성공 여부를 묻지 않는다.
            아이는 직접 텍스트를 입력하지 않고 버튼만 누른다. 너는 짧은 질문 1개와 짧은 선택지 1~3개만 만든다.
            questionText 는 30자 이내, 각 choice text 는 18자 이내, choiceIntentId 는 snake_case 짧은 식별자.
            "오늘은 쉬고 싶어요"(rest_today)는 첫 화면에서만 제공된다 — 후속 질문(현재 호출)에는 절대 포함하지 마라.
            choiceIntentId 는 반드시 다음 16종 중에서만 골라라:
              mood_okay, mood_worried, mood_hard, rest_today,
              worry_pain, worry_unknown, worry_family,
              hard_body, hard_lonely, hard_angry,
              support_family, support_medical, support_draw,
              action_breathe, action_draw, action_tell
            새 ID 를 만들거나 변형하지 마라.
            npcResponse 는 직전 선택을 인정하는 짧은 1~2 줄 ack 멘트 (각 줄 40자 이내).
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
        String prevChoiceIntentId =
                turnsAscByStepIndex.isEmpty()
                        ? null
                        : turnsAscByStepIndex
                                .get(turnsAscByStepIndex.size() - 1)
                                .getChoiceIntentId();
        Optional<ClaudeClient.ClaudeSceneResult> validated =
                validate(result.get(), prevChoiceIntentId);
        if (validated.isEmpty()) {
            log.warn(
                    "Claude response failed validation for session {} — falling back",
                    session.getId());
            return Optional.empty();
        }
        return Optional.of(toSceneResponse(validated.get()));
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
            String prev = last.getChoiceIntentId();
            Set<String> allowedNext = TRANSITION_RULES.getOrDefault(prev, Set.of());
            sb.append("\n방금 아이가 \"").append(last.getChoiceText()).append("\" 를 골랐어. ");
            if (allowedNext.isEmpty()) {
                sb.append("이제 종료할 시점이야 — choices 를 비우고 shouldEndSession=true 로 응답해.");
            } else {
                sb.append("이 흐름에 자연스러운 짧은 다음 질문 + 선택지를 만들어줘. ")
                        .append("choiceIntentId 는 반드시 다음 set 안에서만 골라: ")
                        .append(String.join(", ", allowedNext));
            }
        } else {
            sb.append("\n첫 후속 질문을 짧게 하나 만들어줘.");
        }
        return sb.toString();
    }

    /** 검증 통과한 ClaudeSceneResult 만 통과시킨다. 실패 시 empty. */
    private Optional<ClaudeClient.ClaudeSceneResult> validate(
            ClaudeClient.ClaudeSceneResult result, String prevChoiceIntentId) {
        String q = result.questionText();
        // 종료 신호일 땐 questionText 가 비어도 OK. 그 외엔 비어있으면 안 됨.
        if (!result.shouldEndSession()) {
            if (q == null
                    || q.isBlank()
                    || q.length() > MAX_QUESTION_LENGTH
                    || containsForbidden(q)) {
                return Optional.empty();
            }
        } else if (q != null && containsForbidden(q)) {
            return Optional.empty();
        }
        List<ClaudeClient.ClaudeChoice> choices = result.choices();
        if (choices == null) {
            return Optional.empty();
        }
        Set<String> allowedNext =
                prevChoiceIntentId == null
                        ? ALLOWED_INTENTS
                        : TRANSITION_RULES.getOrDefault(prevChoiceIntentId, Set.of());
        if (result.shouldEndSession()) {
            if (!choices.isEmpty()) {
                return Optional.empty(); // 종료 신호인데 선택지가 있으면 모순
            }
        } else {
            if (choices.size() < MIN_CHOICES || choices.size() > MAX_CHOICES) {
                return Optional.empty();
            }
        }
        for (ClaudeClient.ClaudeChoice c : choices) {
            if (c.choiceIntentId() == null
                    || c.choiceIntentId().isBlank()
                    || !ALLOWED_INTENTS.contains(c.choiceIntentId())
                    || "rest_today".equals(c.choiceIntentId())
                    || !allowedNext.contains(c.choiceIntentId())) {
                return Optional.empty();
            }
            if (c.text() == null
                    || c.text().isBlank()
                    || c.text().length() > MAX_CHOICE_TEXT_LENGTH
                    || containsForbidden(c.text())) {
                return Optional.empty();
            }
        }
        // npcResponse 검증
        List<String> npcResponse = result.npcResponse();
        if (npcResponse == null
                || npcResponse.isEmpty()
                || npcResponse.size() > MAX_NPC_RESPONSE_LINES) {
            return Optional.empty();
        }
        for (String line : npcResponse) {
            if (line == null
                    || line.isBlank()
                    || line.length() > MAX_NPC_RESPONSE_LINE_LENGTH
                    || containsForbidden(line)) {
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
                DialogueTurnGeneratedBy.CLAUDE,
                result.npcResponse());
    }
}
