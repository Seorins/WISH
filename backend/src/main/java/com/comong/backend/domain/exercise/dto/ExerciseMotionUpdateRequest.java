package com.comong.backend.domain.exercise.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import io.swagger.v3.oas.annotations.media.Schema;

public record ExerciseMotionUpdateRequest(
        @Schema(description = "동작명", example = "제자리 걷기")
                @Size(max = 100)
                @Pattern(regexp = ".*\\S.*", message = "공백만 입력할 수 없습니다.")
                String name,
        @Schema(description = "목표 반복 수", example = "8") @Positive Integer targetReps,
        @Schema(description = "동작 설명", example = "좌우 번갈아 제자리에서 걷는다.")
                @Pattern(regexp = ".*\\S.*", message = "공백만 입력할 수 없습니다.")
                String description,
        @Schema(description = "시범 영상 URL", example = "https://example.com/top-march.mp4")
                @Size(max = 500)
                String demoVideoUrl,
        @Schema(description = "썸네일 URL", example = "https://example.com/top-march.png")
                @Size(max = 500)
                String thumbnailUrl) {}
