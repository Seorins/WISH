package com.comong.backend.domain.exercise.dto;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import com.comong.backend.domain.exercise.entity.ExerciseType;

import io.swagger.v3.oas.annotations.media.Schema;

public record ExerciseSessionSaveRequest(
        @Schema(description = "환자 프로필 ID", example = "1") @NotNull Long patientProfileId,
        @Schema(description = "체조 타입", example = "TOP") @NotNull ExerciseType exerciseType,
        @Schema(description = "총 소요 시간(초)", example = "78") @NotNull @PositiveOrZero
                Integer durationSec,
        @Schema(description = "세션 평균 정확도(0~1)", example = "0.87")
                @NotNull
                @DecimalMin("0.0")
                @DecimalMax("1.0")
                Double averageAccuracy,
        @Schema(description = "동작별 수행 결과") @NotEmpty
                List<@NotNull @Valid ExerciseSessionMotionSaveRequest> motions) {}
