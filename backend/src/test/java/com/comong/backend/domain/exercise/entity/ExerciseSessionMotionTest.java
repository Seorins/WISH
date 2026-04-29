package com.comong.backend.domain.exercise.entity;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.Test;

class ExerciseSessionMotionTest {

    @Test
    void builder_rejectsNullSession() {
        assertThatThrownBy(
                        () ->
                                ExerciseSessionMotion.builder()
                                        .session(null)
                                        .motion(mock(Motion.class))
                                        .durationSec(12)
                                        .accuracy(0.91)
                                        .completedReps(8)
                                        .feedback("Raise your knee higher.")
                                        .build())
                .isInstanceOf(NullPointerException.class)
                .hasMessageContaining("session");
    }

    @Test
    void builder_rejectsNullMotion() {
        assertThatThrownBy(
                        () ->
                                ExerciseSessionMotion.builder()
                                        .session(mock(ExerciseSession.class))
                                        .motion(null)
                                        .durationSec(12)
                                        .accuracy(0.91)
                                        .completedReps(8)
                                        .feedback("Raise your knee higher.")
                                        .build())
                .isInstanceOf(NullPointerException.class)
                .hasMessageContaining("motion");
    }

    @Test
    void builder_rejectsNegativeDurationSec() {
        assertThatThrownBy(
                        () ->
                                ExerciseSessionMotion.builder()
                                        .session(mock(ExerciseSession.class))
                                        .motion(mock(Motion.class))
                                        .durationSec(-1)
                                        .accuracy(0.91)
                                        .completedReps(8)
                                        .feedback("Raise your knee higher.")
                                        .build())
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("durationSec");
    }

    @Test
    void builder_rejectsOutOfRangeAccuracy() {
        assertThatThrownBy(
                        () ->
                                ExerciseSessionMotion.builder()
                                        .session(mock(ExerciseSession.class))
                                        .motion(mock(Motion.class))
                                        .durationSec(12)
                                        .accuracy(1.1)
                                        .completedReps(8)
                                        .feedback("Raise your knee higher.")
                                        .build())
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("accuracy");
    }

    @Test
    void builder_rejectsNegativeCompletedReps() {
        assertThatThrownBy(
                        () ->
                                ExerciseSessionMotion.builder()
                                        .session(mock(ExerciseSession.class))
                                        .motion(mock(Motion.class))
                                        .durationSec(12)
                                        .accuracy(0.91)
                                        .completedReps(-1)
                                        .feedback("Raise your knee higher.")
                                        .build())
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("completedReps");
    }

    @Test
    void builder_rejectsNullFeedback() {
        assertThatThrownBy(
                        () ->
                                ExerciseSessionMotion.builder()
                                        .session(mock(ExerciseSession.class))
                                        .motion(mock(Motion.class))
                                        .durationSec(12)
                                        .accuracy(0.91)
                                        .completedReps(8)
                                        .feedback(null)
                                        .build())
                .isInstanceOf(NullPointerException.class)
                .hasMessageContaining("feedback");
    }
}
