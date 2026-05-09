package com.comong.backend.domain.dialogue.dto;

import java.time.LocalDateTime;
import java.util.List;

import com.comong.backend.domain.dialogue.entity.DialogueTurn;
import com.comong.backend.domain.dialogue.entity.DialogueTurnGeneratedBy;

/** 디버그/QA 용 턴 상세. 아이 화면에는 노출하지 않는다. */
public record TurnDetailResponse(
        Long id,
        int stepIndex,
        String questionText,
        String choiceIntentId,
        String choiceText,
        short intensity,
        List<String> concernFlags,
        List<String> protectiveFactors,
        DialogueTurnGeneratedBy generatedBy,
        LocalDateTime createdAt) {

    public static TurnDetailResponse from(DialogueTurn turn) {
        return new TurnDetailResponse(
                turn.getId(),
                turn.getStepIndex(),
                turn.getQuestionText(),
                turn.getChoiceIntentId(),
                turn.getChoiceText(),
                turn.getIntensity(),
                turn.getConcernFlags(),
                turn.getProtectiveFactors(),
                turn.getGeneratedBy(),
                turn.getCreatedAt());
    }
}
