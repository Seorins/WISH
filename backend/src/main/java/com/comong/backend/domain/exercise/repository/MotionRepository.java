package com.comong.backend.domain.exercise.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.comong.backend.domain.exercise.entity.ExerciseType;
import com.comong.backend.domain.exercise.entity.Motion;

public interface MotionRepository extends JpaRepository<Motion, Long> {

    List<Motion> findAllByExerciseTypeOrderByRoutineOrderAsc(ExerciseType exerciseType);

    boolean existsByExerciseTypeAndRoutineOrder(ExerciseType exerciseType, int routineOrder);
}
