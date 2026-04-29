package com.comong.backend.domain.exercise.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.comong.backend.domain.exercise.entity.ExerciseSession;

public interface ExerciseSessionRepository extends JpaRepository<ExerciseSession, Long> {

    List<ExerciseSession> findAllByPatientProfileIdOrderByCreatedAtDesc(Long patientId);
}
