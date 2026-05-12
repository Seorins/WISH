package com.comong.backend.domain.dialogue.service;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Component;

/**
 * 등대지기 16개 {@code choiceIntentId} 의 분석 metadata catalog. {@code intensity} / {@code concernFlags} /
 * {@code protectiveFactors} 를 한 곳에서 관리한다.
 *
 * <p>등대지기는 BE 가 Claude/fallback 으로 흐름을 책임지고 intent 풀이 고정(16종)이라 BE catalog 가 진실. {@link
 * com.comong.backend.domain.dialogue.service.DialogueService#submitTurn} 가 등대지기 turn 적재 시 FE 가 보낸
 * 값을 무시하고 본 catalog 값으로 override 한다 (FE 변조 차단 + LLM 응답에 metadata 없어도 적재 보장).
 *
 * <p>마을 주민은 본 catalog 미사용 — FE 가 자체 스크립트의 metadata 그대로 보내고 BE 가 그대로 저장 (NPC 별 고유 intent 풀 + 멘트라 BE
 * 카탈로그화 부적합).
 *
 * <p>데이터 출처: {@code frontend/.../lighthouse/dialog/lighthouseEmotionDialogue.ts} 의 각 choice 정의 값
 * 그대로 이식 (호환성 유지).
 */
@Component
public class LighthouseIntentCatalog {

    /** 16개 등대지기 choiceIntentId → 분석 metadata. */
    private static final Map<String, ChoiceIntentMetadata> METADATA =
            Map.ofEntries(
                    Map.entry(
                            "mood_okay",
                            new ChoiceIntentMetadata(
                                    (short) 0, List.of(), List.of("positive_mood"))),
                    Map.entry(
                            "mood_worried",
                            new ChoiceIntentMetadata(
                                    (short) 2, List.of("worry_present"), List.of("emotion_named"))),
                    Map.entry(
                            "mood_hard",
                            new ChoiceIntentMetadata(
                                    (short) 2,
                                    List.of("distress_present"),
                                    List.of("emotion_named"))),
                    Map.entry(
                            "rest_today",
                            new ChoiceIntentMetadata(
                                    (short) 1, List.of("ended_checkin"), List.of("sets_boundary"))),
                    Map.entry(
                            "worry_pain",
                            new ChoiceIntentMetadata(
                                    (short) 3,
                                    List.of("pain_concern", "procedure_fear"),
                                    List.of("can_name_fear"))),
                    Map.entry(
                            "worry_unknown",
                            new ChoiceIntentMetadata(
                                    (short) 2,
                                    List.of("uncertainty"),
                                    List.of("information_need_named"))),
                    Map.entry(
                            "worry_family",
                            new ChoiceIntentMetadata(
                                    (short) 3, List.of("parent_concern"), List.of("empathy"))),
                    Map.entry(
                            "hard_body",
                            new ChoiceIntentMetadata(
                                    (short) 3,
                                    List.of("body_discomfort"),
                                    List.of("body_state_named"))),
                    Map.entry(
                            "hard_lonely",
                            new ChoiceIntentMetadata(
                                    (short) 3, List.of("loneliness"), List.of("emotion_named"))),
                    Map.entry(
                            "hard_angry",
                            new ChoiceIntentMetadata(
                                    (short) 2,
                                    List.of("anger_or_frustration"),
                                    List.of("emotion_named"))),
                    Map.entry(
                            "support_family",
                            new ChoiceIntentMetadata(
                                    (short) 0, List.of(), List.of("family_support_preference"))),
                    Map.entry(
                            "support_medical",
                            new ChoiceIntentMetadata(
                                    (short) 0, List.of(), List.of("medical_support_preference"))),
                    Map.entry(
                            "support_draw",
                            new ChoiceIntentMetadata(
                                    (short) 0,
                                    List.of("prefers_nonverbal_expression"),
                                    List.of("alternative_expression"))),
                    Map.entry(
                            "action_breathe",
                            new ChoiceIntentMetadata(
                                    (short) 0, List.of(), List.of("breathing_coping"))),
                    Map.entry(
                            "action_draw",
                            new ChoiceIntentMetadata(
                                    (short) 0, List.of(), List.of("creative_expression"))),
                    Map.entry(
                            "action_tell",
                            new ChoiceIntentMetadata(
                                    (short) 0, List.of(), List.of("adult_support_plan"))));

    /** 주어진 choiceIntentId 의 metadata 조회. 16종 외면 empty. */
    public Optional<ChoiceIntentMetadata> lookup(String choiceIntentId) {
        return Optional.ofNullable(METADATA.get(choiceIntentId));
    }

    /** 등대지기 turn 저장 시 BE 가 부여하는 분석 metadata. FE 가 보낸 값은 무시되고 본 record 값이 적재된다. */
    public record ChoiceIntentMetadata(
            short intensity, List<String> concernFlags, List<String> protectiveFactors) {}
}
