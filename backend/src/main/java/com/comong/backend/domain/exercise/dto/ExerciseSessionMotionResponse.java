package com.comong.backend.domain.exercise.dto;

import java.time.LocalDateTime;

import com.comong.backend.domain.exercise.entity.ExerciseSessionMotion;

public record ExerciseSessionMotionResponse(
        Long id,
        Long exerciseMotionId,
        String motionName,
        int routineOrder,
        int durationSec,
        double accuracy,
        int completedReps,
        String feedback,
        LocalDateTime createdAt) {

    public static ExerciseSessionMotionResponse from(ExerciseSessionMotion sessionMotion) {
        return new ExerciseSessionMotionResponse(
                sessionMotion.getId(),
                sessionMotion.getExerciseMotion().getId(),
                sessionMotion.getExerciseMotion().getName(),
                sessionMotion.getExerciseMotion().getRoutineOrder(),
                sessionMotion.getDurationSec(),
                sessionMotion.getAccuracy(),
                sessionMotion.getCompletedReps(),
                sessionMotion.getFeedback(),
                sessionMotion.getCreatedAt());
    }
}
