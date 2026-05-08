package com.comong.backend.domain.dialogue.entity;

import java.time.LocalDateTime;
import java.util.Objects;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import com.comong.backend.domain.patient.entity.PatientProfile;

import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * NPC 와의 한 차례 대화 세션. 등대지기(LLM) / 마을 주민(정적 스크립트) 모두 동일 스키마로 저장한다.
 *
 * <p>턴(질문 → 선택)은 {@link DialogueTurn} 으로 분리되며 {@code (session_id, step_index)} UNIQUE 가 idempotency
 * 를 DB 레벨에서 보장한다.
 */
@Entity
@Getter
@Table(name = "dialogue_sessions")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DialogueSession {

    private static final int DEFAULT_MAX_STEPS = 3;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "patient_profile_id", nullable = false)
    private PatientProfile patientProfile;

    @Enumerated(EnumType.STRING)
    @Column(name = "npc_type", nullable = false, length = 32)
    private NpcType npcType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private DialogueStatus status;

    @Column(name = "step_count", nullable = false)
    private int stepCount;

    @Column(name = "max_steps", nullable = false)
    private int maxSteps;

    @Enumerated(EnumType.STRING)
    @Column(name = "finish_reason", length = 32)
    private DialogueFinishReason finishReason;

    @Column(name = "started_at", nullable = false, updatable = false)
    private LocalDateTime startedAt;

    @Column(name = "ended_at")
    private LocalDateTime endedAt;

    @Builder
    private DialogueSession(PatientProfile patientProfile, NpcType npcType, Integer maxSteps) {
        this.patientProfile =
                Objects.requireNonNull(patientProfile, "patientProfile must not be null");
        this.npcType = Objects.requireNonNull(npcType, "npcType must not be null");
        int resolvedMaxSteps = maxSteps != null ? maxSteps : DEFAULT_MAX_STEPS;
        if (resolvedMaxSteps <= 0) {
            throw new IllegalArgumentException("maxSteps must be positive");
        }
        this.maxSteps = resolvedMaxSteps;
        this.status = DialogueStatus.IN_PROGRESS;
        this.stepCount = 0;
    }

    @PrePersist
    void prePersist() {
        this.startedAt = LocalDateTime.now();
    }
}
