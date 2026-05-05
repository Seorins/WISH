package com.comong.backend.domain.taekwondo.service;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.comong.backend.domain.patient.entity.PatientProfile;
import com.comong.backend.domain.patient.service.PatientProfileService;
import com.comong.backend.domain.taekwondo.dto.TaekwondoSessionMotionResponse;
import com.comong.backend.domain.taekwondo.dto.TaekwondoSessionMotionSaveRequest;
import com.comong.backend.domain.taekwondo.dto.TaekwondoSessionResponse;
import com.comong.backend.domain.taekwondo.dto.TaekwondoSessionSaveRequest;
import com.comong.backend.domain.taekwondo.dto.TaekwondoSessionSummaryResponse;
import com.comong.backend.domain.taekwondo.entity.TaekwondoMotion;
import com.comong.backend.domain.taekwondo.entity.TaekwondoSession;
import com.comong.backend.domain.taekwondo.entity.TaekwondoSessionMotion;
import com.comong.backend.domain.taekwondo.exception.TaekwondoErrorCode;
import com.comong.backend.domain.taekwondo.repository.TaekwondoMotionRepository;
import com.comong.backend.domain.taekwondo.repository.TaekwondoSessionMotionRepository;
import com.comong.backend.domain.taekwondo.repository.TaekwondoSessionRepository;
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

    @Transactional
    public TaekwondoSessionResponse create(Long userId, TaekwondoSessionSaveRequest request) {
        PatientProfile patientProfile =
                patientProfileService.findOwnedOrThrow(userId, request.patientProfileId());
        Map<Long, TaekwondoMotion> motionMap = loadTaekwondoMotionMap(request.motions());

        TaekwondoSession session =
                taekwondoSessionRepository.save(
                        TaekwondoSession.builder()
                                .patientProfile(patientProfile)
                                .poomsae(request.poomsae())
                                .durationSec(request.durationSec())
                                .averageAccuracy(request.averageAccuracy())
                                .completedMotionCount(request.motions().size())
                                .monstersDefeated(request.monstersDefeated())
                                .build());

        List<TaekwondoSessionMotion> sessionMotions =
                request.motions().stream()
                        .map(motionRequest -> toSessionMotion(session, motionRequest, motionMap))
                        .toList();
        List<TaekwondoSessionMotion> savedSessionMotions =
                taekwondoSessionMotionRepository.saveAll(sessionMotions);

        return TaekwondoSessionResponse.of(
                session,
                savedSessionMotions.stream().map(TaekwondoSessionMotionResponse::from).toList());
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
                        .map(TaekwondoSessionMotionResponse::from)
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

    private Map<Long, TaekwondoMotion> loadTaekwondoMotionMap(
            List<TaekwondoSessionMotionSaveRequest> requests) {
        List<Long> motionIds =
                requests.stream()
                        .map(TaekwondoSessionMotionSaveRequest::taekwondoMotionId)
                        .distinct()
                        .toList();
        Map<Long, TaekwondoMotion> motionMap =
                taekwondoMotionRepository.findAllById(motionIds).stream()
                        .collect(Collectors.toMap(TaekwondoMotion::getId, Function.identity()));

        if (motionMap.size() != motionIds.size()) {
            throw new BusinessException(TaekwondoErrorCode.TAEKWONDO_MOTION_NOT_FOUND);
        }
        return motionMap;
    }

    private TaekwondoSessionMotion toSessionMotion(
            TaekwondoSession session,
            TaekwondoSessionMotionSaveRequest request,
            Map<Long, TaekwondoMotion> motionMap) {
        TaekwondoMotion motion = motionMap.get(request.taekwondoMotionId());
        if (session.getPoomsae() != motion.getPoomsae()) {
            throw new BusinessException(
                    TaekwondoErrorCode.TAEKWONDO_SESSION_MOTION_POOMSAE_MISMATCH);
        }

        return TaekwondoSessionMotion.builder()
                .session(session)
                .motion(motion)
                .durationSec(request.durationSec())
                .accuracy(request.accuracy())
                .completedReps(request.completedReps())
                .feedback(request.feedback())
                .build();
    }
}
