package com.comong.backend.domain.exercise.entity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class MotionTest {

    @Test
    void builder_setsFieldsAndTimestamp() {
        Motion motion =
                Motion.builder()
                        .exerciseType(ExerciseType.TOP)
                        .name("March")
                        .routineOrder(1)
                        .targetReps(8)
                        .description("Walk in place.")
                        .demoVideoUrl("https://example.com/march.mp4")
                        .thumbnailUrl("https://example.com/march.png")
                        .build();

        motion.prePersist();

        assertThat(motion.getExerciseType()).isEqualTo(ExerciseType.TOP);
        assertThat(motion.getName()).isEqualTo("March");
        assertThat(motion.getRoutineOrder()).isEqualTo(1);
        assertThat(motion.getTargetReps()).isEqualTo(8);
        assertThat(motion.getDescription()).isEqualTo("Walk in place.");
        assertThat(motion.getDemoVideoUrl()).isEqualTo("https://example.com/march.mp4");
        assertThat(motion.getThumbnailUrl()).isEqualTo("https://example.com/march.png");
        assertThat(motion.getCreatedAt()).isNotNull();
        assertThat(motion.getUpdatedAt()).isNotNull();
    }

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
