package com.comong.backend.domain.dialogue.service;

import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.comong.backend.domain.dialogue.dto.ChoiceResponse;
import com.comong.backend.domain.dialogue.dto.SceneResponse;
import com.comong.backend.domain.dialogue.entity.DialogueFinishReason;
import com.comong.backend.domain.dialogue.entity.DialogueSession;
import com.comong.backend.domain.dialogue.entity.DialogueTurnGeneratedBy;
import com.comong.backend.domain.dialogue.entity.NpcName;

/**
 * LLM 미연동 / Claude 실패 시 사용할 정적 시나리오 트리. 등대지기 영철의 전 흐름을 결정론적으로 제공한다.
 *
 * <p>구조: (이전 선택, 누적 stepCount) → (다음 장면 + ack 멘트). 모든 라우팅은 in-memory 상수로 표현하여 외부 의존성 없이 즉시 fallback
 * 가능.
 *
 * <p>마을 주민 6인은 FE 가 정적 스크립트를 보유하므로 본 provider 는 호출되지 않는다 — 호출자({@link DialogueService})가 {@link
 * NpcName#isBackendDriven()} 으로 분기 후 BE-driven NPC 만 진입한다.
 */
@Component
public class FallbackSceneProvider {

    // ===== 첫 화면 (npcResponse 비어있음 — 직전 선택 없음) =====

    private static final SceneResponse YEONGCHEOL_FIRST_SCENE =
            new SceneResponse(
                    "오늘 기분은 어떠니?",
                    List.of(
                            ChoiceResponse.of("mood_okay", "괜찮아요"),
                            ChoiceResponse.of("mood_worried", "걱정돼요"),
                            ChoiceResponse.of("mood_hard", "힘들어요")),
                    ChoiceResponse.of("rest_today", "오늘은 쉬고 싶어요"),
                    /* shouldEndSession= */ false,
                    DialogueTurnGeneratedBy.FALLBACK,
                    /* npcResponse= */ List.of());

    // ===== 후속 장면 템플릿 (질문 + 선택지). ack 는 prev choice 에 따라 외부에서 주입 =====

    private record SceneTemplate(String questionText, List<ChoiceResponse> choices) {}

    private static final SceneTemplate TEMPLATE_WORRY_SOURCE =
            new SceneTemplate(
                    "무엇이 가장 걱정되니?",
                    List.of(
                            ChoiceResponse.of("worry_pain", "아픈 게 걱정돼요"),
                            ChoiceResponse.of("worry_unknown", "잘 모르겠어요"),
                            ChoiceResponse.of("worry_family", "가족이 걱정돼요")));

    private static final SceneTemplate TEMPLATE_HARD_PART =
            new SceneTemplate(
                    "지금 가장 힘든 건 뭐니?",
                    List.of(
                            ChoiceResponse.of("hard_body", "몸이 힘들어요"),
                            ChoiceResponse.of("hard_lonely", "외로워요"),
                            ChoiceResponse.of("hard_angry", "화가 나요")));

    private static final SceneTemplate TEMPLATE_SMALL_ACTION =
            new SceneTemplate(
                    "지금 해볼 수 있는 작은 일은?",
                    List.of(
                            ChoiceResponse.of("action_breathe", "숨을 천천히 쉬어요"),
                            ChoiceResponse.of("action_draw", "그림을 그려요"),
                            ChoiceResponse.of("action_tell", "한마디 해볼래요")));

    private static final SceneTemplate TEMPLATE_SUPPORT_CHOICE =
            new SceneTemplate(
                    "어떻게 도움을 받아볼까?",
                    List.of(
                            ChoiceResponse.of("support_family", "가족에게 말할래요"),
                            ChoiceResponse.of("support_medical", "선생님께 말할래요"),
                            ChoiceResponse.of("support_draw", "그림으로 전할래요")));

    // ===== 직전 선택 → ack 멘트 =====

    private static final Map<String, List<String>> ACK_BY_PREV_CHOICE =
            Map.ofEntries(
                    Map.entry("mood_okay", List.of("좋구나. 작은 햇빛이 보이는 날이네.")),
                    Map.entry("mood_worried", List.of("걱정이 찾아왔구나.")),
                    Map.entry("mood_hard", List.of("말해줘서 고맙구나.")),
                    Map.entry("worry_pain", List.of("아픈 게 걱정될 수 있지.")),
                    Map.entry("worry_unknown", List.of("잘 모를 때 더 답답할 수 있단다.")),
                    Map.entry("worry_family", List.of("가족을 많이 아끼는구나.")),
                    Map.entry("hard_body", List.of("몸이 힘들면 마음도 지치기 쉽지.")),
                    Map.entry("hard_lonely", List.of("혼자 있는 것처럼 느껴졌구나.")),
                    Map.entry("hard_angry", List.of("화나는 마음도 말해도 괜찮아.")),
                    Map.entry("support_family", List.of("가족에게 한마디 건네보자.")),
                    Map.entry("support_medical", List.of("선생님께 말해도 된단다.")),
                    Map.entry("support_draw", List.of("말이 어려우면 그림도 좋단다.")),
                    Map.entry("action_breathe", List.of("좋구나. 숨은 작은 닻이 된단다.")),
                    Map.entry("action_draw", List.of("그림도 마음의 말이 될 수 있지.")),
                    Map.entry("action_tell", List.of("좋다. 한마디면 충분할 때도 있단다.")));

    // ===== 마무리 대사 =====

    private static final List<String> CLOSING_LINES_COMPLETED =
            List.of("오늘 말해줘서 고맙구나.", "등대 불은 여기 켜두마.");

    private static final List<String> CLOSING_LINES_REST =
            List.of("알겠다. 오늘은 쉬어도 괜찮단다.", "등대 불은 조용히 켜두마.");

    private static final List<String> CLOSING_LINES_TIMEOUT =
            List.of("오늘 여기서 멈추자꾸나.", "등대 불은 조용히 켜두마.");

    /** 새 세션의 첫 장면. BE-driven NPC 에 한해 호출되어야 한다. */
    public SceneResponse firstScene(NpcName npcName) {
        requireBackendDriven(npcName);
        return YEONGCHEOL_FIRST_SCENE;
    }

    /**
     * 직전 선택 + 현재 stepCount 를 보고 다음 장면을 결정. {@link DialogueSession#isAtMaxSteps()} 인 경우와 일부
     * 선택지(action_breathe/draw, support_*)에선 즉시 종료 신호를 반환한다. ack 멘트는 직전 선택에 따라 주입된다.
     */
    public SceneResponse nextScene(
            NpcName npcName, String prevChoiceIntentId, int newStepCount, int maxSteps) {
        requireBackendDriven(npcName);
        List<String> ack = ackFor(prevChoiceIntentId);
        if (newStepCount >= maxSteps) {
            return endScene(ack);
        }
        SceneTemplate template = chooseTemplate(prevChoiceIntentId);
        if (template == null) {
            return endScene(ack);
        }
        return toScene(template, ack);
    }

    /** 종료 시 NPC 가 남기는 짧은 마무리 대사 (1~2 줄). BE-driven NPC 에 한해 호출되어야 한다. */
    public List<String> closingLines(NpcName npcName, DialogueFinishReason reason) {
        requireBackendDriven(npcName);
        return switch (reason) {
            case COMPLETED -> CLOSING_LINES_COMPLETED;
            case REST_TODAY -> CLOSING_LINES_REST;
            case TIMEOUT -> CLOSING_LINES_TIMEOUT;
        };
    }

    /** 직전 선택지에 대응하는 ack 멘트. 매핑 외 선택은 빈 리스트. */
    public List<String> ackFor(String prevChoiceIntentId) {
        return ACK_BY_PREV_CHOICE.getOrDefault(prevChoiceIntentId, List.of());
    }

    private static SceneTemplate chooseTemplate(String prevChoiceIntentId) {
        return switch (prevChoiceIntentId) {
            case "mood_okay" -> TEMPLATE_SMALL_ACTION;
            case "mood_worried" -> TEMPLATE_WORRY_SOURCE;
            case "mood_hard" -> TEMPLATE_HARD_PART;
            case "worry_pain", "worry_unknown", "worry_family" -> TEMPLATE_SUPPORT_CHOICE;
            case "hard_body", "hard_lonely", "hard_angry" -> TEMPLATE_SUPPORT_CHOICE;
            case "action_tell" -> TEMPLATE_SUPPORT_CHOICE;
            // action_breathe / action_draw / support_* / 알 수 없는 choice → 종료 신호 (null)
            default -> null;
        };
    }

    private static SceneResponse toScene(SceneTemplate template, List<String> npcResponse) {
        return new SceneResponse(
                template.questionText(),
                template.choices(),
                /* secondaryAction= */ null,
                /* shouldEndSession= */ false,
                DialogueTurnGeneratedBy.FALLBACK,
                npcResponse);
    }

    private static SceneResponse endScene(List<String> npcResponse) {
        return new SceneResponse(
                "",
                List.of(),
                /* secondaryAction= */ null,
                /* shouldEndSession= */ true,
                DialogueTurnGeneratedBy.FALLBACK,
                npcResponse);
    }

    private static void requireBackendDriven(NpcName npcName) {
        if (!npcName.isBackendDriven()) {
            // 호출자(DialogueService)가 NpcName.isBackendDriven() 으로 분기해야 한다.
            // 이 시점에 도달하면 라우팅 버그.
            throw new IllegalStateException(
                    "FallbackSceneProvider only handles backend-driven NPC, got " + npcName);
        }
    }
}
