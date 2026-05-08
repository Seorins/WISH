package com.comong.backend.domain.patient.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.comong.backend.domain.patient.entity.PatientProfile;

public interface PatientProfileRepository extends JpaRepository<PatientProfile, Long> {

    List<PatientProfile> findAllByUserId(Long userId);

    @Query("select p from PatientProfile p join fetch p.user")
    List<PatientProfile> findAllWithUser();

    boolean existsByUserId(Long userId);

    long countByCreatedAtBetween(java.time.LocalDateTime start, java.time.LocalDateTime end);
}
