package com.comong.backend.domain.exercise.entity;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class MotionTest {

    @Test
    void builder_rejectsNullExerciseType() {
        assertThatThrownBy(
                        () ->
                                Motion.builder()
                                        .exerciseType(null)
                                        .name("March")
                                        .routineOrder(1)
                                        .targetReps(8)
                                        .description("Walk in place.")
                                        .build())
                .isInstanceOf(NullPointerException.class)
                .hasMessageContaining("exerciseType");
    }

    @Test
    void builder_rejectsNonPositiveRoutineOrder() {
        assertThatThrownBy(
                        () ->
                                Motion.builder()
                                        .exerciseType(ExerciseType.TOP)
                                        .name("March")
                                        .routineOrder(0)
                                        .targetReps(8)
                                        .description("Walk in place.")
                                        .build())
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("routineOrder");
    }

    @Test
    void builder_rejectsNonPositiveTargetReps() {
        assertThatThrownBy(
                        () ->
                                Motion.builder()
                                        .exerciseType(ExerciseType.TOP)
                                        .name("March")
                                        .routineOrder(1)
                                        .targetReps(0)
                                        .description("Walk in place.")
                                        .build())
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("targetReps");
    }

    @Test
    void builder_rejectsNullDescription() {
        assertThatThrownBy(
                        () ->
                                Motion.builder()
                                        .exerciseType(ExerciseType.TOP)
                                        .name("March")
                                        .routineOrder(1)
                                        .targetReps(8)
                                        .description(null)
                                        .build())
                .isInstanceOf(NullPointerException.class)
                .hasMessageContaining("description");
    }
}
