package com.comong.backend.domain.music.service;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.comong.backend.domain.music.dto.MusicBestResultResponse;
import com.comong.backend.domain.music.dto.MusicResultResponse;
import com.comong.backend.domain.music.dto.MusicResultSaveRequest;
import com.comong.backend.domain.music.entity.MusicChart;
import com.comong.backend.domain.music.entity.MusicRank;
import com.comong.backend.domain.music.entity.MusicResult;
import com.comong.backend.domain.music.exception.MusicErrorCode;
import com.comong.backend.domain.music.repository.MusicChartRepository;
import com.comong.backend.domain.music.repository.MusicResultRepository;
import com.comong.backend.domain.patient.entity.PatientProfile;
import com.comong.backend.domain.patient.exception.PatientErrorCode;
import com.comong.backend.domain.patient.service.PatientProfileService;
import com.comong.backend.global.exception.BusinessException;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MusicResultService {

    private static final Comparator<MusicResult> BEST_RESULT_COMPARATOR =
            Comparator.comparingInt(MusicResult::getScore)
                    .thenComparingDouble(MusicResult::getAccuracy)
                    .thenComparing(MusicResult::getPlayedAt);

    private final MusicChartRepository musicChartRepository;
    private final MusicResultRepository musicResultRepository;
    private final PatientProfileService patientProfileService;

    @Transactional
    public MusicResultResponse create(Long userId, MusicResultSaveRequest request) {
        PatientProfile patientProfile =
                patientProfileService
                        .findEntityByUserId(userId)
                        .orElseThrow(
                                () ->
                                        new BusinessException(
                                                PatientErrorCode.PATIENT_PROFILE_NOT_FOUND));
        MusicChart musicChart = findActiveChartOrThrow(request.chartId());

        validateNoteCounts(request);
        validateChartTotalNotes(musicChart, request.totalNotes());

        double accuracy = calculateAccuracy(request);
        MusicRank rank = MusicRank.fromAccuracy(accuracy);

        Integer previousBestScore =
                musicResultRepository
                        .findTopByPatientProfileIdAndMusicChartIdOrderByScoreDescAccuracyDescPlayedAtDesc(
                                patientProfile.getId(), musicChart.getId())
                        .map(MusicResult::getScore)
                        .orElse(null);
        boolean isNewBest = previousBestScore == null || request.score() > previousBestScore;

        MusicResult saved =
                musicResultRepository.save(
                        MusicResult.builder()
                                .patientProfile(patientProfile)
                                .musicChart(musicChart)
                                .score(request.score())
                                .maxCombo(request.maxCombo())
                                .perfectCount(request.perfectCount())
                                .goodCount(request.goodCount())
                                .missCount(request.missCount())
                                .totalNotes(request.totalNotes())
                                .accuracy(accuracy)
                                .rank(rank)
                                .playedDurationMs(request.playedDurationMs())
                                .build());

        return MusicResultResponse.of(saved, isNewBest, previousBestScore);
    }

    public List<MusicBestResultResponse> findMyBest(Long userId) {
        PatientProfile patientProfile =
                patientProfileService
                        .findEntityByUserId(userId)
                        .orElseThrow(
                                () ->
                                        new BusinessException(
                                                PatientErrorCode.PATIENT_PROFILE_NOT_FOUND));

        Map<String, List<MusicResult>> resultsByChart =
                musicResultRepository
                        .findAllByPatientProfileIdWithMusicChart(patientProfile.getId())
                        .stream()
                        .collect(
                                Collectors.groupingBy(
                                        result -> result.getMusicChart().getChartId(),
                                        TreeMap::new,
                                        Collectors.toList()));

        return resultsByChart.values().stream().map(this::toBestResultResponse).toList();
    }

    private MusicChart findActiveChartOrThrow(String chartId) {
        return musicChartRepository
                .findByChartIdAndActiveTrue(chartId)
                .orElseThrow(() -> new BusinessException(MusicErrorCode.MUSIC_CHART_NOT_FOUND));
    }

    private void validateNoteCounts(MusicResultSaveRequest request) {
        int judgedNotes = request.perfectCount() + request.goodCount() + request.missCount();
        if (judgedNotes != request.totalNotes()) {
            throw new BusinessException(MusicErrorCode.MUSIC_RESULT_NOTE_COUNT_MISMATCH);
        }
    }

    private void validateChartTotalNotes(MusicChart musicChart, int requestTotalNotes) {
        if (musicChart.getTotalNotes() != requestTotalNotes) {
            throw new BusinessException(MusicErrorCode.MUSIC_CHART_TOTAL_NOTES_MISMATCH);
        }
    }

    private double calculateAccuracy(MusicResultSaveRequest request) {
        return (request.perfectCount() + request.goodCount() * 0.6) / request.totalNotes();
    }

    private MusicBestResultResponse toBestResultResponse(List<MusicResult> results) {
        MusicResult bestResult = results.stream().max(BEST_RESULT_COMPARATOR).orElseThrow();
        LocalDateTime lastPlayedAt =
                results.stream()
                        .map(MusicResult::getPlayedAt)
                        .max(LocalDateTime::compareTo)
                        .orElseThrow();

        return MusicBestResultResponse.of(bestResult, results.size(), lastPlayedAt);
    }
}
