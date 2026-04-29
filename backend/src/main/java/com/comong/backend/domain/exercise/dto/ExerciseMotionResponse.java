package com.comong.backend.domain.exercise.dto;

import java.time.LocalDateTime;

import com.comong.backend.domain.exercise.entity.ExerciseMotion;
import com.comong.backend.domain.exercise.entity.ExerciseType;

public record ExerciseMotionResponse(
        Long id,
        ExerciseType exerciseType,
        String name,
        int routineOrder,
        int targetReps,
        String description,
        String demoVideoUrl,
        String thumbnailUrl,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {

    public static ExerciseMotionResponse from(ExerciseMotion exerciseMotion) {
        return new ExerciseMotionResponse(
                exerciseMotion.getId(),
                exerciseMotion.getExerciseType(),
                exerciseMotion.getName(),
                exerciseMotion.getRoutineOrder(),
                exerciseMotion.getTargetReps(),
                exerciseMotion.getDescription(),
                exerciseMotion.getDemoVideoUrl(),
                exerciseMotion.getThumbnailUrl(),
                exerciseMotion.getCreatedAt(),
                exerciseMotion.getUpdatedAt());
    }
}
