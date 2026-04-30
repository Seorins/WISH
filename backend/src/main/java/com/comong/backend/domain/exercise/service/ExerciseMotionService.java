package com.comong.backend.domain.exercise.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.comong.backend.domain.exercise.dto.ExerciseMotionCreateRequest;
import com.comong.backend.domain.exercise.dto.ExerciseMotionResponse;
import com.comong.backend.domain.exercise.dto.ExerciseMotionUpdateRequest;
import com.comong.backend.domain.exercise.entity.ExerciseMotion;
import com.comong.backend.domain.exercise.entity.ExerciseType;
import com.comong.backend.domain.exercise.exception.ExerciseErrorCode;
import com.comong.backend.domain.exercise.repository.ExerciseMotionRepository;
import com.comong.backend.domain.exercise.repository.ExerciseSessionMotionRepository;
import com.comong.backend.global.exception.BusinessException;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ExerciseMotionService {

    private final ExerciseMotionRepository exerciseMotionRepository;
    private final ExerciseSessionMotionRepository sessionMotionRepository;

    public List<ExerciseMotionResponse> findAllByExerciseType(ExerciseType exerciseType) {
        return exerciseMotionRepository
                .findAllByExerciseTypeOrderByRoutineOrderAsc(exerciseType)
                .stream()
                .map(ExerciseMotionResponse::from)
                .toList();
    }

    public ExerciseMotionResponse findOne(Long id) {
        return ExerciseMotionResponse.from(findOrThrow(id));
    }

    @Transactional
    public ExerciseMotionResponse create(ExerciseMotionCreateRequest request) {
        if (exerciseMotionRepository.existsByExerciseTypeAndRoutineOrder(
                request.exerciseType(), request.routineOrder())) {
            throw new BusinessException(ExerciseErrorCode.EXERCISE_MOTION_ROUTINE_ORDER_DUPLICATED);
        }

        ExerciseMotion saved =
                exerciseMotionRepository.save(
                        ExerciseMotion.builder()
                                .exerciseType(request.exerciseType())
                                .name(request.name())
                                .routineOrder(request.routineOrder())
                                .targetReps(request.targetReps())
                                .description(request.description())
                                .demoVideoUrl(request.demoVideoUrl())
                                .thumbnailUrl(request.thumbnailUrl())
                                .build());
        return ExerciseMotionResponse.from(saved);
    }

    @Transactional
    public ExerciseMotionResponse update(Long id, ExerciseMotionUpdateRequest request) {
        ExerciseMotion exerciseMotion = findOrThrow(id);
        exerciseMotion.update(
                request.name(),
                request.targetReps(),
                request.description(),
                request.demoVideoUrl(),
                request.thumbnailUrl());
        return ExerciseMotionResponse.from(exerciseMotion);
    }

    @Transactional
    public void delete(Long id) {
        ExerciseMotion exerciseMotion = findOrThrow(id);
        if (sessionMotionRepository.existsByExerciseMotionId(id)) {
            throw new BusinessException(ExerciseErrorCode.EXERCISE_MOTION_IN_USE);
        }

        exerciseMotionRepository.delete(exerciseMotion);
    }

    private ExerciseMotion findOrThrow(Long id) {
        return exerciseMotionRepository
                .findById(id)
                .orElseThrow(
                        () -> new BusinessException(ExerciseErrorCode.EXERCISE_MOTION_NOT_FOUND));
    }
}
