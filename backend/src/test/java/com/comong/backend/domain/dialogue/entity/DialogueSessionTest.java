package com.comong.backend.domain.dialogue.entity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.Test;

import com.comong.backend.domain.patient.entity.PatientProfile;

class DialogueSessionTest {

    @Test
    void builder_setsDefaultsAndStartedAt() {
        DialogueSession session = newSession();
        session.prePersist();

        assertThat(session.getNpcName()).isEqualTo(NpcName.YEONGCHEOL);
        assertThat(session.getStatus()).isEqualTo(DialogueStatus.IN_PROGRESS);
        assertThat(session.getStepCount()).isZero();
        assertThat(session.getMaxSteps()).isEqualTo(3);
        assertThat(session.getFinishReason()).isNull();
        assertThat(session.getEndedAt()).isNull();
        assertThat(session.getStartedAt()).isNotNull();
    }

    @Test
    void builder_overridesMaxSteps() {
        DialogueSession session =
                DialogueSession.builder()
                        .patientProfile(mock(PatientProfile.class))
                        .npcName(NpcName.JOEUN)
                        .maxSteps(5)
                        .build();
        assertThat(session.getMaxSteps()).isEqualTo(5);
    }

    @Test
    void builder_rejectsNullNpcName() {
        assertThatThrownBy(
                        () ->
                                DialogueSession.builder()
                                        .patientProfile(mock(PatientProfile.class))
                                        .npcName(null)
                                        .build())
                .isInstanceOf(NullPointerException.class)
                .hasMessageContaining("npcName");
    }

    @Test
    void builder_rejectsNonPositiveMaxSteps() {
        assertThatThrownBy(
                        () ->
                                DialogueSession.builder()
                                        .patientProfile(mock(PatientProfile.class))
                                        .npcName(NpcName.YEONGCHEOL)
                                        .maxSteps(0)
                                        .build())
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("maxSteps");
    }

    @Test
    void incrementStepCount_increasesAndStopsAtMaxSteps() {
        DialogueSession session = newSession(); // maxSteps=3

        session.incrementStepCount();
        session.incrementStepCount();
        session.incrementStepCount();

        assertThat(session.getStepCount()).isEqualTo(3);
        assertThat(session.isAtMaxSteps()).isTrue();
        assertThatThrownBy(session::incrementStepCount)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("stepCount cannot exceed maxSteps");
    }

    @Test
    void finish_setsTerminalStateAndReason() {
        DialogueSession session = newSession();

        session.finish(DialogueFinishReason.COMPLETED);

        assertThat(session.getStatus()).isEqualTo(DialogueStatus.FINISHED);
        assertThat(session.getFinishReason()).isEqualTo(DialogueFinishReason.COMPLETED);
        assertThat(session.getEndedAt()).isNotNull();
    }

    @Test
    void finish_rejectsAlreadyFinishedSession() {
        DialogueSession session = newSession();
        session.finish(DialogueFinishReason.COMPLETED);

        assertThatThrownBy(() -> session.finish(DialogueFinishReason.REST_TODAY))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("IN_PROGRESS");
    }

    @Test
    void finish_rejectsNullReason() {
        DialogueSession session = newSession();

        assertThatThrownBy(() -> session.finish(null))
                .isInstanceOf(NullPointerException.class)
                .hasMessageContaining("reason");
    }

    @Test
    void abandon_setsAbandonedStatusWithoutFinishReason() {
        DialogueSession session = newSession();

        session.abandon();

        assertThat(session.getStatus()).isEqualTo(DialogueStatus.ABANDONED);
        assertThat(session.getFinishReason()).isNull();
        assertThat(session.getEndedAt()).isNotNull();
    }

    @Test
    void abandon_rejectsAlreadyTerminalSession() {
        DialogueSession session = newSession();
        session.finish(DialogueFinishReason.COMPLETED);

        assertThatThrownBy(session::abandon)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("IN_PROGRESS");
    }

    @Test
    void incrementStepCount_rejectsTerminalSession() {
        DialogueSession session = newSession();
        session.finish(DialogueFinishReason.COMPLETED);

        assertThatThrownBy(session::incrementStepCount)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("IN_PROGRESS");
    }

    private DialogueSession newSession() {
        return DialogueSession.builder()
                .patientProfile(mock(PatientProfile.class))
                .npcName(NpcName.YEONGCHEOL)
                .build();
    }
}
