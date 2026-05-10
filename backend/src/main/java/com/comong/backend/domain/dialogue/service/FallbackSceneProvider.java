package com.comong.backend.domain.dialogue.service;

import java.util.List;

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
 * <p>구조: (이전 선택, 누적 stepCount) → 다음 장면. 모든 라우팅은 in-memory 상수로 표현하여 외부 의존성 없이 즉시 fallback 가능.
 *
 * <p>마을 주민 6인은 FE 가 정적 스크립트를 보유하므로 본 provider 는 호출되지 않는다 — 호출자({@link DialogueService})가 {@link
 * NpcName#isBackendDriven()} 으로 분기 후 BE-driven NPC 만 진입한다.
 */
@Component
public class FallbackSceneProvider {

    // ===== 첫 화면 =====

    private static final SceneResponse YEONGCHEOL_FIRST_SCENE =
            new SceneResponse(
                    "오늘 기분은 어떠니?",
                    List.of(
                            ChoiceResponse.of("mood_okay", "괜찮아요"),
                            ChoiceResponse.of("mood_worried", "걱정돼요"),
                            ChoiceResponse.of("mood_hard", "힘들어요")),
                    ChoiceResponse.of("rest_today", "오늘은 쉬고 싶어요"),
                    false,
                    DialogueTurnGeneratedBy.FALLBACK);

    // ===== 후속 장면 (secondaryAction 항상 null) =====

    private static final SceneResponse SCENE_WORRY_SOURCE =
            scene(
                    "무엇이 가장 걱정되니?",
                    ChoiceResponse.of("worry_pain", "아픈 게 걱정돼요"),
                    ChoiceResponse.of("worry_unknown", "잘 모르겠어요"),
                    ChoiceResponse.of("worry_family", "가족이 걱정돼요"));

    private static final SceneResponse SCENE_HARD_PART =
            scene(
                    "지금 가장 힘든 건 뭐니?",
                    ChoiceResponse.of("hard_body", "몸이 힘들어요"),
                    ChoiceResponse.of("hard_lonely", "외로워요"),
                    ChoiceResponse.of("hard_angry", "화가 나요"));

    private static final SceneResponse SCENE_SMALL_ACTION =
            scene(
                    "지금 해볼 수 있는 작은 일은?",
                    ChoiceResponse.of("action_breathe", "숨을 천천히 쉬어요"),
                    ChoiceResponse.of("action_draw", "그림을 그려요"),
                    ChoiceResponse.of("action_tell", "한마디 해볼래요"));

    private static final SceneResponse SCENE_SUPPORT_CHOICE =
            scene(
                    "어떻게 도움을 받아볼까?",
                    ChoiceResponse.of("support_family", "가족에게 말할래요"),
                    ChoiceResponse.of("support_medical", "선생님께 말할래요"),
                    ChoiceResponse.of("support_draw", "그림으로 전할래요"));

    // ===== 종료 신호 =====

    private static final SceneResponse SCENE_END =
            new SceneResponse(
                    "",
                    List.of(),
                    null,
                    /* shouldEndSession= */ true,
                    DialogueTurnGeneratedBy.FALLBACK);

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
     * 선택지(action_breathe/draw)에선 즉시 종료 신호를 반환한다.
     */
    public SceneResponse nextScene(
            NpcName npcName, String prevChoiceIntentId, int newStepCount, int maxSteps) {
        requireBackendDriven(npcName);
        if (newStepCount >= maxSteps) {
            return SCENE_END;
        }
        return switch (prevChoiceIntentId) {
            case "mood_okay" -> SCENE_SMALL_ACTION;
            case "mood_worried" -> SCENE_WORRY_SOURCE;
            case "mood_hard" -> SCENE_HARD_PART;
            case "worry_pain", "worry_unknown", "worry_family" -> SCENE_SUPPORT_CHOICE;
            case "hard_body", "hard_lonely", "hard_angry" -> SCENE_SUPPORT_CHOICE;
            case "action_tell" -> SCENE_SUPPORT_CHOICE;
            case "action_breathe", "action_draw" -> SCENE_END;
            case "support_family", "support_medical", "support_draw" -> SCENE_END;
            // 미정의 / 비정상 choice — 안전하게 종료
            default -> SCENE_END;
        };
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

    private static void requireBackendDriven(NpcName npcName) {
        if (!npcName.isBackendDriven()) {
            // 호출자(DialogueService)가 NpcName.isBackendDriven() 으로 분기해야 한다.
            // 이 시점에 도달하면 라우팅 버그.
            throw new IllegalStateException(
                    "FallbackSceneProvider only handles backend-driven NPC, got " + npcName);
        }
    }

    private static SceneResponse scene(
            String questionText, ChoiceResponse a, ChoiceResponse b, ChoiceResponse c) {
        return new SceneResponse(
                questionText,
                List.of(a, b, c),
                /* secondaryAction= */ null,
                /* shouldEndSession= */ false,
                DialogueTurnGeneratedBy.FALLBACK);
    }
}
