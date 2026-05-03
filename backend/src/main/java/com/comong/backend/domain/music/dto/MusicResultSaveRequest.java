package com.comong.backend.domain.music.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

import io.swagger.v3.oas.annotations.media.Schema;

public record MusicResultSaveRequest(
        @Schema(description = "곡 식별자", example = "baby-shark") @NotBlank String chartId,
        @Schema(description = "점수", example = "24830") @NotNull @PositiveOrZero Integer score,
        @Schema(description = "최대 콤보", example = "87") @NotNull @PositiveOrZero
                Integer maxCombo,
        @Schema(description = "Perfect 판정 개수", example = "142") @NotNull @PositiveOrZero
                Integer perfectCount,
        @Schema(description = "Good 판정 개수", example = "23") @NotNull @PositiveOrZero
                Integer goodCount,
        @Schema(description = "Miss 판정 개수", example = "10") @NotNull @PositiveOrZero
                Integer missCount,
        @Schema(description = "전체 노트 수", example = "175") @NotNull @Positive Integer totalNotes,
        @Schema(description = "실제 플레이 시간(ms)", example = "96196") @NotNull @PositiveOrZero
                Integer playedDurationMs) {}
