package com.comong.backend.domain.exercise.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.comong.backend.domain.exercise.entity.ExerciseSessionMotion;

public interface ExerciseSessionMotionRepository
        extends JpaRepository<ExerciseSessionMotion, Long> {

    List<ExerciseSessionMotion> findAllBySessionId(Long sessionId);

    boolean existsByExerciseMotionId(Long exerciseMotionId);
}
