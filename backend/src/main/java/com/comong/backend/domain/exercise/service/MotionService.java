package com.comong.backend.domain.exercise.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.comong.backend.domain.exercise.dto.MotionResponse;
import com.comong.backend.domain.exercise.entity.ExerciseType;
import com.comong.backend.domain.exercise.repository.MotionRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MotionService {

    private final MotionRepository motionRepository;

    public List<MotionResponse> findAllByExerciseType(ExerciseType exerciseType) {
        return motionRepository.findAllByExerciseTypeOrderByRoutineOrderAsc(exerciseType).stream()
                .map(MotionResponse::from)
                .toList();
    }
}
