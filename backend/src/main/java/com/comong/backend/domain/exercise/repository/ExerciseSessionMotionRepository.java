package com.comong.backend.domain.exercise.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.comong.backend.domain.exercise.entity.ExerciseSessionMotion;

public interface ExerciseSessionMotionRepository
        extends JpaRepository<ExerciseSessionMotion, Long> {

    List<ExerciseSessionMotion> findAllBySessionId(Long sessionId);

    @Query(
            "select sm from ExerciseSessionMotion sm "
                    + "join fetch sm.exerciseMotion m "
                    + "where sm.session.id = :sessionId "
                    + "order by m.routineOrder asc")
    List<ExerciseSessionMotion> findAllBySessionIdWithExerciseMotionOrderByRoutineOrderAsc(
            @Param("sessionId") Long sessionId);

    boolean existsByExerciseMotionId(Long exerciseMotionId);
}
