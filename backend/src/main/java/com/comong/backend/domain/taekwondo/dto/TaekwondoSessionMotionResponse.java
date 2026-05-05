package com.comong.backend.domain.taekwondo.dto;

import java.time.LocalDateTime;

import com.comong.backend.domain.taekwondo.entity.TaekwondoSessionMotion;

public record TaekwondoSessionMotionResponse(
        Long id,
        Long taekwondoMotionId,
        String motionName,
        int routineOrder,
        int durationSec,
        double accuracy,
        int completedReps,
        String feedback,
        LocalDateTime createdAt) {

    public static TaekwondoSessionMotionResponse from(TaekwondoSessionMotion sessionMotion) {
        return new TaekwondoSessionMotionResponse(
                sessionMotion.getId(),
                sessionMotion.getMotion().getId(),
                sessionMotion.getMotion().getName(),
                sessionMotion.getMotion().getRoutineOrder(),
                sessionMotion.getDurationSec(),
                sessionMotion.getAccuracy(),
                sessionMotion.getCompletedReps(),
                sessionMotion.getFeedback(),
                sessionMotion.getCreatedAt());
    }
}
