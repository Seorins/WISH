package com.comong.backend.domain.patient.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.comong.backend.domain.patient.entity.PatientProfile;

public interface PatientProfileRepository extends JpaRepository<PatientProfile, Long> {

    List<PatientProfile> findAllByUserId(Long userId);

    boolean existsByUserId(Long userId);
}
