package com.comong.backend.domain.exercise.dto;

import java.time.LocalDateTime;

import com.comong.backend.domain.exercise.entity.ExerciseType;
import com.comong.backend.domain.exercise.entity.Motion;

public record MotionResponse(
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

    public static MotionResponse from(Motion motion) {
        return new MotionResponse(
                motion.getId(),
                motion.getExerciseType(),
                motion.getName(),
                motion.getRoutineOrder(),
                motion.getTargetReps(),
                motion.getDescription(),
                motion.getDemoVideoUrl(),
                motion.getThumbnailUrl(),
                motion.getCreatedAt(),
                motion.getUpdatedAt());
    }
}
