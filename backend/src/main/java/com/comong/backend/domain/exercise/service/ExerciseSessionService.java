package com.comong.backend.domain.exercise.service;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.comong.backend.domain.exercise.dto.ExerciseSessionMotionResponse;
import com.comong.backend.domain.exercise.dto.ExerciseSessionMotionSaveRequest;
import com.comong.backend.domain.exercise.dto.ExerciseSessionResponse;
import com.comong.backend.domain.exercise.dto.ExerciseSessionSaveRequest;
import com.comong.backend.domain.exercise.dto.ExerciseSessionSummaryResponse;
import com.comong.backend.domain.exercise.entity.ExerciseMotion;
import com.comong.backend.domain.exercise.entity.ExerciseSession;
import com.comong.backend.domain.exercise.entity.ExerciseSessionMotion;
import com.comong.backend.domain.exercise.exception.ExerciseErrorCode;
import com.comong.backend.domain.exercise.repository.ExerciseMotionRepository;
import com.comong.backend.domain.exercise.repository.ExerciseSessionMotionRepository;
import com.comong.backend.domain.exercise.repository.ExerciseSessionRepository;
import com.comong.backend.domain.patient.entity.PatientProfile;
import com.comong.backend.domain.patient.service.PatientProfileService;
import com.comong.backend.global.exception.BusinessException;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ExerciseSessionService {

    private final ExerciseSessionRepository exerciseSessionRepository;
    private final ExerciseSessionMotionRepository exerciseSessionMotionRepository;
    private final ExerciseMotionRepository exerciseMotionRepository;
    private final PatientProfileService patientProfileService;

    @Transactional
    public ExerciseSessionResponse create(Long userId, ExerciseSessionSaveRequest request) {
        PatientProfile patientProfile =
                patientProfileService.findOwnedOrThrow(userId, request.patientProfileId());
        Map<Long, ExerciseMotion> motionMap = loadExerciseMotionMap(request.motions());

        ExerciseSession session =
                exerciseSessionRepository.save(
                        ExerciseSession.builder()
                                .patientProfile(patientProfile)
                                .exerciseType(request.exerciseType())
                                .durationSec(request.durationSec())
                                .averageAccuracy(request.averageAccuracy())
                                .completedMotionCount(request.motions().size())
                                .build());

        List<ExerciseSessionMotion> sessionMotions =
                request.motions().stream()
                        .map(motionRequest -> toSessionMotion(session, motionRequest, motionMap))
                        .toList();
        List<ExerciseSessionMotion> savedSessionMotions =
                exerciseSessionMotionRepository.saveAll(sessionMotions);

        return ExerciseSessionResponse.of(
                session,
                savedSessionMotions.stream().map(ExerciseSessionMotionResponse::from).toList());
    }

    public List<ExerciseSessionSummaryResponse> findAll(Long userId, Long patientProfileId) {
        PatientProfile patientProfile =
                patientProfileService.findOwnedOrThrow(userId, patientProfileId);
        return exerciseSessionRepository
                .findAllByPatientProfileIdOrderByCreatedAtDesc(patientProfile.getId())
                .stream()
                .map(ExerciseSessionSummaryResponse::from)
                .toList();
    }

    public ExerciseSessionResponse findOne(Long userId, Long sessionId) {
        ExerciseSession session = findOwnedSessionOrThrow(userId, sessionId);
        List<ExerciseSessionMotionResponse> motions =
                exerciseSessionMotionRepository
                        .findAllBySessionIdWithExerciseMotionOrderByRoutineOrderAsc(sessionId)
                        .stream()
                        .map(ExerciseSessionMotionResponse::from)
                        .toList();

        return ExerciseSessionResponse.of(session, motions);
    }

    private ExerciseSession findOwnedSessionOrThrow(Long userId, Long sessionId) {
        return exerciseSessionRepository
                .findByIdWithPatientProfileAndUser(sessionId)
                .filter(session -> session.getPatientProfile().getUser().getId().equals(userId))
                .orElseThrow(
                        () -> new BusinessException(ExerciseErrorCode.EXERCISE_SESSION_NOT_FOUND));
    }

    private Map<Long, ExerciseMotion> loadExerciseMotionMap(
            List<ExerciseSessionMotionSaveRequest> requests) {
        List<Long> motionIds =
                requests.stream()
                        .map(ExerciseSessionMotionSaveRequest::exerciseMotionId)
                        .distinct()
                        .toList();
        Map<Long, ExerciseMotion> motionMap =
                exerciseMotionRepository.findAllById(motionIds).stream()
                        .collect(Collectors.toMap(ExerciseMotion::getId, Function.identity()));

        if (motionMap.size() != motionIds.size()) {
            throw new BusinessException(ExerciseErrorCode.EXERCISE_MOTION_NOT_FOUND);
        }
        return motionMap;
    }

    private ExerciseSessionMotion toSessionMotion(
            ExerciseSession session,
            ExerciseSessionMotionSaveRequest request,
            Map<Long, ExerciseMotion> motionMap) {
        ExerciseMotion exerciseMotion = motionMap.get(request.exerciseMotionId());
        if (session.getExerciseType() != exerciseMotion.getExerciseType()) {
            throw new BusinessException(ExerciseErrorCode.EXERCISE_SESSION_MOTION_TYPE_MISMATCH);
        }

        return ExerciseSessionMotion.builder()
                .session(session)
                .exerciseMotion(exerciseMotion)
                .durationSec(request.durationSec())
                .accuracy(request.accuracy())
                .completedReps(request.completedReps())
                .feedback(request.feedback())
                .build();
    }
}
