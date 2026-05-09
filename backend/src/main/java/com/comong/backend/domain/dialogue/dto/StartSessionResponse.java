package com.comong.backend.domain.dialogue.dto;

import com.comong.backend.domain.dialogue.entity.DialogueSession;
import com.comong.backend.domain.dialogue.entity.DialogueStatus;

import io.swagger.v3.oas.annotations.media.Schema;

/** 세션 시작 응답. 세션 식별자와 첫 장면을 함께 반환한다. */
public record StartSessionResponse(
        @Schema(description = "발급된 세션 ID", example = "42") Long sessionId,
        @Schema(description = "현재 세션 상태") DialogueStatus status,
        @Schema(description = "첫 장면") SceneResponse scene) {

    public static StartSessionResponse of(DialogueSession session, SceneResponse scene) {
        return new StartSessionResponse(session.getId(), session.getStatus(), scene);
    }
}
