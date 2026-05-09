package com.comong.backend.domain.dialogue.service;

import java.util.List;

import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.comong.backend.domain.dialogue.dto.FinishSessionRequest;
import com.comong.backend.domain.dialogue.dto.FinishSessionResponse;
import com.comong.backend.domain.dialogue.dto.SceneResponse;
import com.comong.backend.domain.dialogue.dto.SelectedChoiceRequest;
import com.comong.backend.domain.dialogue.dto.SessionDetailResponse;
import com.comong.backend.domain.dialogue.dto.StartSessionRequest;
import com.comong.backend.domain.dialogue.dto.StartSessionResponse;
import com.comong.backend.domain.dialogue.dto.SubmitTurnRequest;
import com.comong.backend.domain.dialogue.dto.SubmitTurnResponse;
import com.comong.backend.domain.dialogue.entity.DialogueSession;
import com.comong.backend.domain.dialogue.entity.DialogueStatus;
import com.comong.backend.domain.dialogue.entity.DialogueTurn;
import com.comong.backend.domain.dialogue.entity.DialogueTurnGeneratedBy;
import com.comong.backend.domain.dialogue.entity.NpcName;
import com.comong.backend.domain.dialogue.exception.DialogueErrorCode;
import com.comong.backend.domain.dialogue.repository.DialogueSessionRepository;
import com.comong.backend.domain.dialogue.repository.DialogueTurnRepository;
import com.comong.backend.domain.patient.entity.PatientProfile;
import com.comong.backend.domain.patient.service.PatientProfileService;
import com.comong.backend.global.exception.BusinessException;

import lombok.RequiredArgsConstructor;

/**
 * NPC 대화 세션 유스케이스 (시작 / 턴 처리 / 종료 / 조회).
 *
 * <p>인가: 모든 세션 조작은 본인 소유 환자 프로필에 한정된다. 비소유/비존재는 모두 {@link DialogueErrorCode#SESSION_NOT_FOUND}(404)
 * 으로 통일하여 ID enumeration 을 방지한다 (PatientProfileService 와 동일 패턴).
 *
 * <p>현재 단계(556): 등대지기 영철 + Fallback scene tree 만 지원. 마을 주민 5인은 559, Claude LLM 은 558 에서 분기 추가.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DialogueService {

    /** {@link DialogueTurn} 의 (session_id, step_index) UNIQUE 제약 이름. 마이그레이션과 일치. */
    private static final String UK_DIALOGUE_TURN_SESSION_STEP = "uk_dialogue_turn_session_step";

    private final DialogueSessionRepository sessionRepository;
    private final DialogueTurnRepository turnRepository;
    private final PatientProfileService patientProfileService;
    private final FallbackSceneProvider fallbackSceneProvider;

    @Transactional
    public StartSessionResponse createSession(Long currentUserId, StartSessionRequest request) {
        PatientProfile profile =
                patientProfileService.findOwnedOrThrow(currentUserId, request.patientProfileId());
        if (request.npcName() != NpcName.YEONGCHEOL) {
            // 마을 주민은 559 에서 정적 스크립트로 풀어줌
            throw new BusinessException(DialogueErrorCode.NPC_NOT_SUPPORTED_YET);
        }
        DialogueSession session =
                sessionRepository.save(
                        DialogueSession.builder()
                                .patientProfile(profile)
                                .npcName(request.npcName())
                                .build());
        SceneResponse firstScene = fallbackSceneProvider.firstScene(request.npcName());
        return StartSessionResponse.of(session, firstScene);
    }

    @Transactional
    public SubmitTurnResponse submitTurn(
            Long currentUserId, Long sessionId, SubmitTurnRequest request) {
        DialogueSession session = findOwnedSessionOrThrow(currentUserId, sessionId);
        requireInProgress(session);

        SelectedChoiceRequest choice = request.selectedChoice();
        int stepIndex = session.getStepCount();
        String questionText = deriveQuestionForStep(session, stepIndex);

        try {
            turnRepository.saveAndFlush(
                    DialogueTurn.builder()
                            .session(session)
                            .stepIndex(stepIndex)
                            .questionText(questionText)
                            .choiceIntentId(choice.choiceIntentId())
                            .choiceText(choice.text())
                            .intensity(choice.intensity())
                            .concernFlags(choice.concernFlags())
                            .protectiveFactors(choice.protectiveFactors())
                            .generatedBy(DialogueTurnGeneratedBy.FALLBACK)
                            .build());
        } catch (DataIntegrityViolationException e) {
            throw mapTurnConstraintViolation(e);
        }

        session.incrementStepCount();

        SceneResponse nextScene =
                fallbackSceneProvider.nextScene(
                        session.getNpcName(),
                        choice.choiceIntentId(),
                        session.getStepCount(),
                        session.getMaxSteps());

        return SubmitTurnResponse.of(session, nextScene);
    }

    @Transactional
    public FinishSessionResponse finishSession(
            Long currentUserId, Long sessionId, FinishSessionRequest request) {
        DialogueSession session = findOwnedSessionOrThrow(currentUserId, sessionId);
        requireInProgress(session);
        session.finish(request.finishReason());
        List<String> closingLines =
                fallbackSceneProvider.closingLines(session.getNpcName(), request.finishReason());
        return FinishSessionResponse.of(session, closingLines);
    }

    public SessionDetailResponse getSession(Long currentUserId, Long sessionId) {
        DialogueSession session = findOwnedSessionOrThrow(currentUserId, sessionId);
        List<DialogueTurn> turns =
                turnRepository.findAllBySessionIdOrderByStepIndexAsc(session.getId());
        return SessionDetailResponse.from(session, turns);
    }

    // ===== helpers =====

    /** 비소유/비존재 모두 404 로 통일 (enumeration 방지). */
    private DialogueSession findOwnedSessionOrThrow(Long currentUserId, Long sessionId) {
        return sessionRepository
                .findById(sessionId)
                .filter(s -> s.getPatientProfile().getUser().getId().equals(currentUserId))
                .orElseThrow(() -> new BusinessException(DialogueErrorCode.SESSION_NOT_FOUND));
    }

    private void requireInProgress(DialogueSession session) {
        if (session.getStatus() != DialogueStatus.IN_PROGRESS) {
            throw new BusinessException(DialogueErrorCode.SESSION_ALREADY_FINISHED);
        }
    }

    /**
     * 주어진 stepIndex 에서 화면에 노출되었던 질문 텍스트를 결정론적으로 derive. 첫 step 은 NPC 의 firstScene, 이후는 직전 turn 의
     * choice 를 라우팅 테이블에 통과시켜 얻는다.
     *
     * <p>558 에서 Claude 가 들어오면 question 이 비결정론적이라 이 derive 가 안 통한다 → 그 시점에 session 에 last_question
     * 컬럼을 추가하거나 다른 전략으로 전환.
     */
    private String deriveQuestionForStep(DialogueSession session, int stepIndex) {
        if (stepIndex == 0) {
            return fallbackSceneProvider.firstScene(session.getNpcName()).questionText();
        }
        DialogueTurn previous =
                turnRepository
                        .findBySessionIdAndStepIndex(session.getId(), stepIndex - 1)
                        .orElseThrow(
                                () ->
                                        new IllegalStateException(
                                                "previous turn missing at stepIndex="
                                                        + (stepIndex - 1)));
        return fallbackSceneProvider
                .nextScene(
                        session.getNpcName(),
                        previous.getChoiceIntentId(),
                        stepIndex,
                        session.getMaxSteps())
                .questionText();
    }

    private RuntimeException mapTurnConstraintViolation(DataIntegrityViolationException e) {
        for (Throwable cause = e.getCause(); cause != null; cause = cause.getCause()) {
            if (cause instanceof ConstraintViolationException cve
                    && UK_DIALOGUE_TURN_SESSION_STEP.equalsIgnoreCase(cve.getConstraintName())) {
                return new BusinessException(DialogueErrorCode.SESSION_TURN_DUPLICATE);
            }
        }
        return e;
    }
}
