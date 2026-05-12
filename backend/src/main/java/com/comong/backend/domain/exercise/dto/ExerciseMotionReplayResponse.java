package com.comong.backend.domain.exercise.dto;

import com.comong.backend.domain.exercise.entity.ExerciseSessionMotion;

public record ExerciseMotionReplayResponse(
        Long motionResultId,
        Long exerciseMotionId,
        String motionName,
        int routineOrder,
        boolean replayAvailable,
        ExerciseMotionReplayData replay) {

    public static ExerciseMotionReplayResponse from(
            ExerciseSessionMotion sessionMotion, ExerciseMotionReplayData replay) {
        return new ExerciseMotionReplayResponse(
                sessionMotion.getId(),
                sessionMotion.getExerciseMotion().getId(),
                sessionMotion.getExerciseMotion().getName(),
                sessionMotion.getExerciseMotion().getRoutineOrder(),
                replay != null,
                replay);
    }
}
