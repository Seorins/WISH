package com.comong.backend.domain.music.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.comong.backend.domain.music.entity.MusicResult;

public interface MusicResultRepository extends JpaRepository<MusicResult, Long> {

    Optional<MusicResult>
            findTopByPatientProfileIdAndMusicChartIdOrderByScoreDescAccuracyDescPlayedAtDesc(
                    Long patientProfileId, Long musicChartId);

    @Query(
            "select r from MusicResult r "
                    + "join fetch r.musicChart "
                    + "where r.patientProfile.id = :patientProfileId")
    List<MusicResult> findAllByPatientProfileIdWithMusicChart(
            @Param("patientProfileId") Long patientProfileId);

    @Query(
            value =
                    "select r from MusicResult r "
                            + "join fetch r.musicChart "
                            + "join r.patientProfile p "
                            + "where p.user.id = :userId",
            countQuery =
                    "select count(r) from MusicResult r "
                            + "join r.patientProfile p "
                            + "where p.user.id = :userId")
    Page<MusicResult> findPageByPatientProfileUserIdWithMusicChart(
            @Param("userId") Long userId, Pageable pageable);

    @Query(
            "select r from MusicResult r "
                    + "join fetch r.musicChart "
                    + "join r.patientProfile p "
                    + "where r.id = :resultId "
                    + "and p.user.id = :userId")
    Optional<MusicResult> findByIdAndPatientProfileUserIdWithMusicChart(
            @Param("resultId") Long resultId, @Param("userId") Long userId);
}
