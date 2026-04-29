package com.comong.backend.domain.exercise.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.comong.backend.domain.exercise.dto.MotionCreateRequest;
import com.comong.backend.domain.exercise.dto.MotionResponse;
import com.comong.backend.domain.exercise.entity.ExerciseType;
import com.comong.backend.domain.exercise.entity.Motion;
import com.comong.backend.domain.exercise.exception.ExerciseErrorCode;
import com.comong.backend.domain.exercise.repository.ExerciseSessionMotionRepository;
import com.comong.backend.domain.exercise.repository.MotionRepository;
import com.comong.backend.global.exception.BusinessException;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MotionService {

    private final MotionRepository motionRepository;
    private final ExerciseSessionMotionRepository sessionMotionRepository;

    public List<MotionResponse> findAllByExerciseType(ExerciseType exerciseType) {
        return motionRepository.findAllByExerciseTypeOrderByRoutineOrderAsc(exerciseType).stream()
                .map(MotionResponse::from)
                .toList();
    }

    @Transactional
    public MotionResponse create(MotionCreateRequest request) {
        if (motionRepository.existsByExerciseTypeAndRoutineOrder(
                request.exerciseType(), request.routineOrder())) {
            throw new BusinessException(ExerciseErrorCode.MOTION_ROUTINE_ORDER_DUPLICATED);
        }

        Motion saved =
                motionRepository.save(
                        Motion.builder()
                                .exerciseType(request.exerciseType())
                                .name(request.name())
                                .routineOrder(request.routineOrder())
                                .targetReps(request.targetReps())
                                .description(request.description())
                                .demoVideoUrl(request.demoVideoUrl())
                                .thumbnailUrl(request.thumbnailUrl())
                                .build());
        return MotionResponse.from(saved);
    }

    @Transactional
    public void delete(Long id) {
        Motion motion =
                motionRepository
                        .findById(id)
                        .orElseThrow(
                                () -> new BusinessException(ExerciseErrorCode.MOTION_NOT_FOUND));
        if (sessionMotionRepository.existsByMotionId(id)) {
            throw new BusinessException(ExerciseErrorCode.MOTION_IN_USE);
        }

        motionRepository.delete(motion);
    }
}
