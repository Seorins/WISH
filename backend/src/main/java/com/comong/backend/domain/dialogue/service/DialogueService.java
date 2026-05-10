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
 * <p>책임 분리: 등대지기(YEONGCHEOL)는 BE 가 scene 생성·라우팅·closingLines 를 모두 책임진다 (현재는 fallback tree, 558 에서
 * Claude 분기 추가). 마을 주민 6인은 FE 가 정적 스크립트(질문/선택지/다음 scene/closingLines)를 보유하며 BE 는 turn raw 데이터 적재만
 * 한다 — 즉 마을 주민 응답에선 {@code scene}, {@code nextScene}, {@code closingLines} 가 모두 {@code null}.
 *
 * <p>인가: 비소유/비존재 모두 {@link DialogueErrorCode#SESSION_NOT_FOUND}(404) 으로 통일하여 ID enumeration 을 방지한다
 * (PatientProfileService 와 동일 패턴).
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
        DialogueSession session =
                sessionRepository.save(
                        DialogueSession.builder()
                                .patientProfile(profile)
                                .npcName(request.npcName())
                                .build());
        SceneResponse firstScene =
                request.npcName().isBackendDriven()
                        ? fallbackSceneProvider.firstScene(request.npcName())
                        : null; // 마을 주민은 FE 가 자체 스크립트로 첫 scene 로드
        return StartSessionResponse.of(session, firstScene);
    }

    @Transactional
    public SubmitTurnResponse submitTurn(
            Long currentUserId, Long sessionId, SubmitTurnRequest request) {
        DialogueSession session = findOwnedSessionOrThrow(currentUserId, sessionId);
        requireInProgress(session);

        SelectedChoiceRequest choice = request.selectedChoice();
        int stepIndex = session.getStepCount();
        DialogueTurnGeneratedBy generatedBy =
                session.getNpcName().isBackendDriven()
                        ? DialogueTurnGeneratedBy.FALLBACK
                        : DialogueTurnGeneratedBy.NPC_SCRIPT;

        try {
            turnRepository.saveAndFlush(
                    DialogueTurn.builder()
                            .session(session)
                            .stepIndex(stepIndex)
                            .questionText(request.questionText())
                            .choiceIntentId(choice.choiceIntentId())
                            .choiceText(choice.text())
                            .intensity(choice.intensity())
                            .concernFlags(choice.concernFlags())
                            .protectiveFactors(choice.protectiveFactors())
                            .generatedBy(generatedBy)
                            .build());
        } catch (DataIntegrityViolationException e) {
            throw mapTurnConstraintViolation(e);
        }

        session.incrementStepCount();

        SceneResponse nextScene =
                session.getNpcName().isBackendDriven()
                        ? fallbackSceneProvider.nextScene(
                                session.getNpcName(),
                                choice.choiceIntentId(),
                                session.getStepCount(),
                                session.getMaxSteps())
                        : null; // 마을 주민은 FE 가 자체 라우팅
        return SubmitTurnResponse.of(session, nextScene);
    }

    @Transactional
    public FinishSessionResponse finishSession(
            Long currentUserId, Long sessionId, FinishSessionRequest request) {
        DialogueSession session = findOwnedSessionOrThrow(currentUserId, sessionId);
        requireInProgress(session);
        session.finish(request.finishReason());
        List<String> closingLines =
                session.getNpcName().isBackendDriven()
                        ? fallbackSceneProvider.closingLines(
                                session.getNpcName(), request.finishReason())
                        : null; // 마을 주민은 FE 가 자체 closingLines 표시
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
