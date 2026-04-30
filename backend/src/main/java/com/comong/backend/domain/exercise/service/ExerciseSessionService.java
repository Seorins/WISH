package com.comong.backend.domain.exercise.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.comong.backend.domain.exercise.dto.ExerciseSessionMotionResponse;
import com.comong.backend.domain.exercise.dto.ExerciseSessionMotionSaveRequest;
import com.comong.backend.domain.exercise.dto.ExerciseSessionResponse;
import com.comong.backend.domain.exercise.dto.ExerciseSessionSaveRequest;
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
        if (request.motions() == null || request.motions().isEmpty()) {
            throw new BusinessException(ExerciseErrorCode.EXERCISE_SESSION_MOTION_REQUIRED);
        }

        PatientProfile patientProfile =
                patientProfileService.findOwnedEntity(userId, request.patientProfileId());
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
                        .map(motionRequest -> toSessionMotion(session, motionRequest))
                        .toList();
        List<ExerciseSessionMotion> savedSessionMotions =
                exerciseSessionMotionRepository.saveAll(sessionMotions);

        return ExerciseSessionResponse.of(
                session,
                savedSessionMotions.stream().map(ExerciseSessionMotionResponse::from).toList());
    }

    private ExerciseSessionMotion toSessionMotion(
            ExerciseSession session, ExerciseSessionMotionSaveRequest request) {
        ExerciseMotion exerciseMotion =
                exerciseMotionRepository
                        .findById(request.exerciseMotionId())
                        .orElseThrow(
                                () ->
                                        new BusinessException(
                                                ExerciseErrorCode.EXERCISE_MOTION_NOT_FOUND));
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
