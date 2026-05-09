package com.comong.backend.domain.dialogue.dto;

import com.comong.backend.domain.dialogue.entity.DialogueSession;
import com.comong.backend.domain.dialogue.entity.DialogueStatus;

import io.swagger.v3.oas.annotations.media.Schema;

/** 한 턴 처리 후 응답. 다음 장면을 포함한다 (또는 종료 신호). */
public record SubmitTurnResponse(
        @Schema(description = "세션 ID", example = "42") Long sessionId,
        @Schema(
                        description =
                                "현재 세션 상태 — 종료 시 FINISHED 가 아니라 IN_PROGRESS 유지. 클라이언트가 finish API 를 호출해야 종료.")
                DialogueStatus status,
        @Schema(description = "다음 장면. {@code shouldEndSession=true} 면 FE 는 finish 호출.")
                SceneResponse nextScene) {

    public static SubmitTurnResponse of(DialogueSession session, SceneResponse nextScene) {
        return new SubmitTurnResponse(session.getId(), session.getStatus(), nextScene);
    }
}
