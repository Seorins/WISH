package com.comong.backend.domain.taekwondo.dto;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import com.comong.backend.domain.taekwondo.entity.Poomsae;

import io.swagger.v3.oas.annotations.media.Schema;

public record TaekwondoSessionSaveRequest(
        @Schema(description = "환자 프로필 ID", example = "1") @NotNull Long patientProfileId,
        @Schema(description = "품새", example = "TAEGEUK_1") @NotNull Poomsae poomsae,
        @Schema(description = "총 소요 시간(초)", example = "120") @NotNull @PositiveOrZero
                Integer durationSec,
        @Schema(description = "세션 평균 정확도(0~1)", example = "0.85")
                @NotNull
                @DecimalMin("0.0")
                @DecimalMax("1.0")
                Double averageAccuracy,
        @Schema(description = "세션 동안 처치한 몬스터 수", example = "12") @NotNull @PositiveOrZero
                Integer monstersDefeated,
        @Schema(description = "동작별 수행 결과") @NotEmpty
                List<@NotNull @Valid TaekwondoSessionMotionSaveRequest> motions) {}
