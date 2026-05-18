package com.comong.backend.domain.taekwondo.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.comong.backend.domain.patient.entity.PatientProfile;
import com.comong.backend.domain.patient.service.PatientProfileService;
import com.comong.backend.domain.performance.entity.PerformanceVideo;
import com.comong.backend.domain.performance.service.PerformanceVideoService;
import com.comong.backend.domain.taekwondo.dto.TaekwondoSessionCreateRequest;
import com.comong.backend.domain.taekwondo.dto.TaekwondoSessionMotionResponse;
import com.comong.backend.domain.taekwondo.dto.TaekwondoSessionMotionSaveRequest;
import com.comong.backend.domain.taekwondo.dto.TaekwondoSessionMotionSaveResponse;
import com.comong.backend.domain.taekwondo.dto.TaekwondoSessionResponse;
import com.comong.backend.domain.taekwondo.dto.TaekwondoSessionSummaryResponse;
import com.comong.backend.domain.taekwondo.entity.TaekwondoMotion;
import com.comong.backend.domain.taekwondo.entity.TaekwondoSession;
import com.comong.backend.domain.taekwondo.entity.TaekwondoSessionMotion;
import com.comong.backend.domain.taekwondo.exception.TaekwondoErrorCode;
import com.comong.backend.domain.taekwondo.repository.TaekwondoMotionRepository;
import com.comong.backend.domain.taekwondo.repository.TaekwondoSessionMotionRepository;
import com.comong.backend.domain.taekwondo.repository.TaekwondoSessionRepository;
import com.comong.backend.domain.upload.dto.UploadPurpose;
import com.comong.backend.global.exception.BusinessException;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TaekwondoSessionService {

    private final TaekwondoSessionRepository taekwondoSessionRepository;
    private final TaekwondoSessionMotionRepository taekwondoSessionMotionRepository;
    private final TaekwondoMotionRepository taekwondoMotionRepository;
    private final PatientProfileService patientProfileService;
    private final PerformanceVideoService performanceVideoService;

    @Transactional
    public TaekwondoSessionResponse create(Long userId, TaekwondoSessionCreateRequest request) {
        PatientProfile patientProfile =
                patientProfileService.findOwnedOrThrow(userId, request.patientProfileId());
        TaekwondoSession session =
                taekwondoSessionRepository.save(
                        TaekwondoSession.builder()
                                .patientProfile(patientProfile)
                                .poomsae(request.poomsae())
                                .durationSec(0)
                                .averageAccuracy(0.0)
                                .completedMotionCount(0)
                                .monstersDefeated(0)
                                .build());
        return TaekwondoSessionResponse.of(session, List.of());
    }

    @Transactional
    public TaekwondoSessionMotionSaveResponse saveMotion(
            Long userId, Long sessionId, TaekwondoSessionMotionSaveRequest request) {
        TaekwondoSession session = findOwnedSessionOrThrow(userId, sessionId);
        TaekwondoMotion motion =
                taekwondoMotionRepository
                        .findById(request.taekwondoMotionId())
                        .orElseThrow(
                                () ->
                                        new BusinessException(
                                                TaekwondoErrorCode.TAEKWONDO_MOTION_NOT_FOUND));
        if (session.getPoomsae() != motion.getPoomsae()) {
            throw new BusinessException(
                    TaekwondoErrorCode.TAEKWONDO_SESSION_MOTION_POOMSAE_MISMATCH);
        }
        PerformanceVideo performanceVideo =
                performanceVideoService.createIfPresent(
                        session.getPatientProfile(),
                        request.videoKey(),
                        request.thumbKey(),
                        UploadPurpose.TAEKWONDO_PERFORMANCE);

        TaekwondoSessionMotion sessionMotion =
                taekwondoSessionMotionRepository.save(
                        TaekwondoSessionMotion.builder()
                                .session(session)
                                .motion(motion)
                                .durationSec(request.durationSec())
                                .accuracy(request.accuracy())
                                .completedReps(request.completedReps())
                                .feedback(request.feedback())
                                .monstersDefeated(request.monstersDefeated())
                                .performanceVideo(performanceVideo)
                                .build());

        session.recordMotion(request.durationSec(), request.accuracy(), request.monstersDefeated());

        // 띠 승급 트리거는 S14P31E103-861 에서 동작 저장 시점으로 이관 — 일단 null.
        return TaekwondoSessionMotionSaveResponse.of(
                session, sessionMotion, null, performanceVideoService);
    }

    public List<TaekwondoSessionSummaryResponse> findAll(Long userId, Long patientProfileId) {
        PatientProfile patientProfile =
                patientProfileService.findOwnedOrThrow(userId, patientProfileId);
        return taekwondoSessionRepository
                .findAllByPatientProfileIdOrderByCreatedAtDesc(patientProfile.getId())
                .stream()
                .map(TaekwondoSessionSummaryResponse::from)
                .toList();
    }

    public TaekwondoSessionResponse findOne(Long userId, Long sessionId) {
        TaekwondoSession session = findOwnedSessionOrThrow(userId, sessionId);
        List<TaekwondoSessionMotionResponse> motions =
                taekwondoSessionMotionRepository
                        .findAllBySessionIdWithMotionOrderByRoutineOrderAsc(sessionId)
                        .stream()
                        .map(
                                motion ->
                                        TaekwondoSessionMotionResponse.from(
                                                motion, performanceVideoService))
                        .toList();

        return TaekwondoSessionResponse.of(session, motions);
    }

    private TaekwondoSession findOwnedSessionOrThrow(Long userId, Long sessionId) {
        return taekwondoSessionRepository
                .findByIdWithPatientProfileAndUser(sessionId)
                .filter(session -> session.getPatientProfile().getUser().getId().equals(userId))
                .orElseThrow(
                        () ->
                                new BusinessException(
                                        TaekwondoErrorCode.TAEKWONDO_SESSION_NOT_FOUND));
    }
}
