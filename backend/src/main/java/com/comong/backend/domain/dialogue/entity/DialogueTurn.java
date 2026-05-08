package com.comong.backend.domain.dialogue.entity;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
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
 * 대화 세션 내 한 턴(질문 + 아이의 선택). EmotionTaggingService 가 {@code choiceIntentId} 기반 고정 매핑으로 {@link
 * #emotionWeights} / {@link #intensity} / {@link #concernFlags} / {@link #protectiveFactors} 를 부여한
 * 결과를 함께 저장한다 (LLM 의 임의 점수 생성 차단).
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

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "emotion_weights", nullable = false, columnDefinition = "jsonb")
    private Map<String, Integer> emotionWeights;

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
            Map<String, Integer> emotionWeights,
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
        this.emotionWeights =
                Objects.requireNonNull(emotionWeights, "emotionWeights must not be null");
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
