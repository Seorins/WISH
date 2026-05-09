package com.comong.backend.domain.dialogue.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import io.swagger.v3.oas.annotations.media.Schema;

/** 한 턴(질문 → 선택)의 결과 제출 요청. */
public record SubmitTurnRequest(
        @Schema(description = "아이가 누른 선택지 정보") @NotNull @Valid
                SelectedChoiceRequest selectedChoice) {}
