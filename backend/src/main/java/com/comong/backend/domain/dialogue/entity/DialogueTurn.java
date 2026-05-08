package com.comong.backend.domain.dialogue.entity;

import java.time.LocalDateTime;
import java.util.List;
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
import jakarta.persistence.UniqueConstraint;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 대화 세션 내 한 턴(질문 + 아이의 선택).
 *
 * <p>FE 가 choice 정의에 박은 {@code intensity} / {@code concernFlags} / {@code protectiveFactors} 를 그대로
 * 받아 적재한다. 태그의 의미 해석은 BE 가 하지 않으며, 향후 LLM 보고서 시점에 turns 의 raw 데이터를 read 하여 처리한다.
 */
@Entity
@Getter
@Table(
        name = "dialogue_turns",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uk_dialogue_turn_session_step",
                        columnNames = {"session_id", "step_index"}))
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DialogueTurn {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_id", nullable = false)
    private DialogueSession session;

    @Column(name = "step_index", nullable = false)
    private int stepIndex;

    @Column(name = "question_text", nullable = false, columnDefinition = "text")
    private String questionText;

    @Column(name = "choice_intent_id", nullable = false, length = 64)
    private String choiceIntentId;

    @Column(name = "choice_text", nullable = false, columnDefinition = "text")
    private String choiceText;

    @Column(nullable = false)
    private short intensity;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "concern_flags", nullable = false, columnDefinition = "jsonb")
    private List<String> concernFlags;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "protective_factors", nullable = false, columnDefinition = "jsonb")
    private List<String> protectiveFactors;

    @Enumerated(EnumType.STRING)
    @Column(name = "generated_by", nullable = false, length = 16)
    private DialogueTurnGeneratedBy generatedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    private DialogueTurn(
            DialogueSession session,
            int stepIndex,
            String questionText,
            String choiceIntentId,
            String choiceText,
            short intensity,
            List<String> concernFlags,
            List<String> protectiveFactors,
            DialogueTurnGeneratedBy generatedBy) {
        this.session = Objects.requireNonNull(session, "session must not be null");
        if (stepIndex < 0) {
            throw new IllegalArgumentException("stepIndex must not be negative");
        }
        this.questionText = Objects.requireNonNull(questionText, "questionText must not be null");
        this.choiceIntentId =
                Objects.requireNonNull(choiceIntentId, "choiceIntentId must not be null");
        this.choiceText = Objects.requireNonNull(choiceText, "choiceText must not be null");
        if (intensity < 0 || intensity > 3) {
            throw new IllegalArgumentException("intensity must be in [0, 3]");
        }
        this.concernFlags = Objects.requireNonNull(concernFlags, "concernFlags must not be null");
        this.protectiveFactors =
                Objects.requireNonNull(protectiveFactors, "protectiveFactors must not be null");
        this.generatedBy = Objects.requireNonNull(generatedBy, "generatedBy must not be null");
        this.stepIndex = stepIndex;
        this.intensity = intensity;
    }

    @PrePersist
    void prePersist() {
        this.createdAt = LocalDateTime.now();
    }
}
