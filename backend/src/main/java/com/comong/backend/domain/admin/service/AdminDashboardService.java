package com.comong.backend.domain.admin.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.comong.backend.domain.admin.dto.AdminDashboardResponse;
import com.comong.backend.domain.patient.entity.PatientProfile;
import com.comong.backend.domain.patient.repository.PatientProfileRepository;
import com.comong.backend.domain.usage.entity.ContentType;
import com.comong.backend.domain.usage.entity.DailyUsageStat;
import com.comong.backend.domain.usage.repository.DailyUsageStatRepository;
import com.comong.backend.domain.usage.repository.UsageAggregationQuery;
import com.comong.backend.domain.user.entity.UserRole;
import com.comong.backend.domain.user.repository.UserRepository;
import com.comong.backend.global.exception.BusinessException;
import com.comong.backend.global.exception.GlobalErrorCode;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminDashboardService {

    private static final int DEFAULT_RANGE_DAYS = 7;
    private static final int RISK_INACTIVE_DAYS = 7;
    private static final long ACTIVE_PERIOD_SECONDS_THRESHOLD = 60L * 60L;
    private static final long CONTENT_SKEW_MIN_SECONDS = 600L;
    private static final long CONTENT_SKEW_PERCENT_THRESHOLD = 80L;

    private final UserRepository userRepository;
    private final PatientProfileRepository patientProfileRepository;
    private final DailyUsageStatRepository dailyUsageStatRepository;
    private final UsageAggregationQuery usageAggregationQuery;

    public AdminDashboardResponse getDashboard(LocalDate from, LocalDate to) {
        LocalDate today = LocalDate.now();
        LocalDate effectiveTo = to != null ? to : today;
        LocalDate effectiveFrom =
                from != null ? from : effectiveTo.minusDays(DEFAULT_RANGE_DAYS - 1L);
        if (effectiveFrom.isAfter(effectiveTo)) {
            throw new BusinessException(GlobalErrorCode.INVALID_INPUT);
        }

        Map<LocalDate, UsageTotals> dailyTotals = createDailyMap(effectiveFrom, effectiveTo);
        Map<LocalDate, Set<Long>> activePatientsByDate =
                createActiveMap(effectiveFrom, effectiveTo);
        Map<Long, PatientUsage> usageByPatient = new HashMap<>();
        UsageTotals periodTotals = new UsageTotals();

        // TODO: pilot 규모를 넘기면 기간/환자 전체 조회를 집계 쿼리나 페이징으로 전환한다.
        List<DailyUsageStat> cachedRows =
                dailyUsageStatRepository.findAllWithPatientByStatDateBetween(
                        effectiveFrom, effectiveTo);
        for (DailyUsageStat row : cachedRows) {
            if (row.getStatDate().equals(today)) {
                continue;
            }
            addPeriodUsage(
                    dailyTotals,
                    activePatientsByDate,
                    usageByPatient,
                    periodTotals,
                    row.getStatDate(),
                    row.getPatientProfile().getId(),
                    row.getContentType(),
                    row.getTotalSeconds());
        }

        Map<Long, UsageTotals> todayLive = computeLiveForDate(today);
        for (Map.Entry<Long, UsageTotals> entry : todayLive.entrySet()) {
            PatientUsage patientUsage =
                    usageByPatient.computeIfAbsent(entry.getKey(), id -> new PatientUsage());
            patientUsage.todaySeconds = entry.getValue().appUsageSeconds();
        }

        if (!today.isBefore(effectiveFrom) && !today.isAfter(effectiveTo)) {
            for (Map.Entry<Long, UsageTotals> entry : todayLive.entrySet()) {
                UsageTotals totals = entry.getValue();
                for (ContentType type : ContentType.values()) {
                    addPeriodUsage(
                            dailyTotals,
                            activePatientsByDate,
                            usageByPatient,
                            periodTotals,
                            today,
                            entry.getKey(),
                            type,
                            totals.get(type));
                }
            }
        }

        List<PatientProfile> patients = patientProfileRepository.findAllWithUser();
        List<AdminDashboardResponse.PatientActivity> patientActivities =
                patients.stream()
                        .map(
                                patient -> {
                                    PatientUsage usage =
                                            usageByPatient.getOrDefault(
                                                    patient.getId(), new PatientUsage());
                                    return toPatientActivity(patient, usage, effectiveTo);
                                })
                        .toList();

        long atRiskPatients =
                patientActivities.stream()
                        .filter(activity -> "RISK".equals(activity.status()))
                        .count();
        long contentSkewedPatients =
                usageByPatient.values().stream().filter(PatientUsage::isContentSkewed).count();
        long todayTotalSeconds =
                todayLive.values().stream().mapToLong(UsageTotals::appUsageSeconds).sum();
        long todayActivePatients =
                todayLive.values().stream().filter(totals -> totals.total() > 0).count();
        long guardianUsers = userRepository.countByRole(UserRole.USER);
        long adminUsers = userRepository.countByRole(UserRole.ADMIN);
        LocalDateTime todayStart = today.atStartOfDay();
        LocalDateTime tomorrowStart = today.plusDays(1).atStartOfDay();
        long dayCount = effectiveTo.toEpochDay() - effectiveFrom.toEpochDay() + 1L;

        AdminDashboardResponse.Summary summary =
                new AdminDashboardResponse.Summary(
                        userRepository.count(),
                        guardianUsers,
                        adminUsers,
                        patientProfileRepository.count(),
                        todayActivePatients,
                        todayTotalSeconds,
                        periodTotals.appUsageSeconds(),
                        dayCount > 0 ? periodTotals.appUsageSeconds() / dayCount : 0,
                        atRiskPatients,
                        userRepository.countByCreatedAtBetween(todayStart, tomorrowStart),
                        patientProfileRepository.countByCreatedAtBetween(
                                todayStart, tomorrowStart));

        return new AdminDashboardResponse(
                effectiveFrom,
                effectiveTo,
                summary,
                toDailyResponses(dailyTotals, activePatientsByDate),
                toContentShares(periodTotals),
                patientActivities,
                toAlerts(summary, guardianUsers, contentSkewedPatients));
    }

    private Map<LocalDate, UsageTotals> createDailyMap(LocalDate from, LocalDate to) {
        Map<LocalDate, UsageTotals> dailyTotals = new LinkedHashMap<>();
        for (LocalDate date = from; !date.isAfter(to); date = date.plusDays(1)) {
            dailyTotals.put(date, new UsageTotals());
        }
        return dailyTotals;
    }

    private Map<LocalDate, Set<Long>> createActiveMap(LocalDate from, LocalDate to) {
        Map<LocalDate, Set<Long>> activePatientsByDate = new LinkedHashMap<>();
        for (LocalDate date = from; !date.isAfter(to); date = date.plusDays(1)) {
            activePatientsByDate.put(date, new HashSet<>());
        }
        return activePatientsByDate;
    }

    private void addPeriodUsage(
            Map<LocalDate, UsageTotals> dailyTotals,
            Map<LocalDate, Set<Long>> activePatientsByDate,
            Map<Long, PatientUsage> usageByPatient,
            UsageTotals periodTotals,
            LocalDate date,
            long patientId,
            ContentType type,
            long seconds) {
        if (seconds <= 0) {
            return;
        }

        dailyTotals.get(date).add(type, seconds);
        activePatientsByDate.get(date).add(patientId);
        periodTotals.add(type, seconds);

        PatientUsage patientUsage =
                usageByPatient.computeIfAbsent(patientId, id -> new PatientUsage());
        patientUsage.add(type, seconds);
        patientUsage.markActive(date);
    }

    private Map<Long, UsageTotals> computeLiveForDate(LocalDate date) {
        Map<Long, UsageTotals> byPatient = new HashMap<>();
        for (UsageAggregationQuery.PatientAggregate row :
                usageAggregationQuery.aggregateLoginPerPatient(date)) {
            byPatient.computeIfAbsent(row.patientProfileId(), id -> new UsageTotals()).login =
                    row.totalSeconds();
        }
        for (UsageAggregationQuery.PatientAggregate row :
                usageAggregationQuery.aggregateMusicPerPatient(date)) {
            byPatient.computeIfAbsent(row.patientProfileId(), id -> new UsageTotals()).music =
                    row.totalSeconds();
        }
        for (UsageAggregationQuery.PatientAggregate row :
                usageAggregationQuery.aggregateTaekwondoPerPatient(date)) {
            byPatient.computeIfAbsent(row.patientProfileId(), id -> new UsageTotals()).taekwondo =
                    row.totalSeconds();
        }
        for (UsageAggregationQuery.PatientAggregate row :
                usageAggregationQuery.aggregateGymnasticsPerPatient(date)) {
            byPatient.computeIfAbsent(row.patientProfileId(), id -> new UsageTotals()).gymnastics =
                    row.totalSeconds();
        }

        UsageAggregationQuery.ArtAggregate art = usageAggregationQuery.aggregateArtPerPatient(date);
        Map<Long, Long> cumulativeArtByPatient = new HashMap<>();
        for (UsageAggregationQuery.PatientAggregate row : art.totalsByPatient()) {
            cumulativeArtByPatient.put(row.patientProfileId(), row.totalSeconds());
        }
        for (Long patientId : art.activePatientIds()) {
            long prior =
                    dailyUsageStatRepository.sumTotalSecondsByContentTypeBeforeForPatient(
                            patientId, ContentType.ART, date);
            long current = cumulativeArtByPatient.getOrDefault(patientId, 0L);
            byPatient.computeIfAbsent(patientId, id -> new UsageTotals()).art =
                    Math.max(0L, current - prior);
        }

        return byPatient;
    }

    private AdminDashboardResponse.PatientActivity toPatientActivity(
            PatientProfile patient, PatientUsage usage, LocalDate periodTo) {
        return new AdminDashboardResponse.PatientActivity(
                patient.getId(),
                patient.getName(),
                patient.getNickname(),
                patient.getUser().getEmail(),
                usage.todaySeconds,
                usage.total.appUsageSeconds(),
                usage.favoriteContentLabel(),
                usage.lastActiveDate,
                usage.status(periodTo));
    }

    private List<AdminDashboardResponse.DailyUsage> toDailyResponses(
            Map<LocalDate, UsageTotals> dailyTotals,
            Map<LocalDate, Set<Long>> activePatientsByDate) {
        List<AdminDashboardResponse.DailyUsage> responses = new ArrayList<>();
        for (Map.Entry<LocalDate, UsageTotals> entry : dailyTotals.entrySet()) {
            UsageTotals totals = entry.getValue();
            responses.add(
                    new AdminDashboardResponse.DailyUsage(
                            entry.getKey(),
                            totals.login,
                            totals.art,
                            totals.music,
                            totals.taekwondo,
                            totals.gymnastics,
                            totals.appUsageSeconds(),
                            activePatientsByDate.get(entry.getKey()).size()));
        }
        return responses;
    }

    private List<AdminDashboardResponse.ContentShare> toContentShares(UsageTotals totals) {
        long contentTotal = totals.contentTotal();
        return List.of(
                toContentShare(ContentType.ART, totals.art, contentTotal),
                toContentShare(ContentType.MUSIC, totals.music, contentTotal),
                toContentShare(ContentType.TAEKWONDO, totals.taekwondo, contentTotal),
                toContentShare(ContentType.GYMNASTICS, totals.gymnastics, contentTotal));
    }

    private AdminDashboardResponse.ContentShare toContentShare(
            ContentType type, long seconds, long contentTotal) {
        double percentage = contentTotal > 0 ? (seconds * 100.0) / contentTotal : 0.0;
        return new AdminDashboardResponse.ContentShare(
                type.name(), contentLabel(type), seconds, Math.round(percentage * 10.0) / 10.0);
    }

    private List<AdminDashboardResponse.DashboardAlert> toAlerts(
            AdminDashboardResponse.Summary summary,
            long guardianUsers,
            long contentSkewedPatients) {
        long missingProfiles = Math.max(0L, guardianUsers - summary.totalPatients());
        return List.of(
                new AdminDashboardResponse.DashboardAlert(
                        "RISK_PATIENT",
                        "이탈 위험 환자",
                        "최근 7일 동안 활동이 없는 환자입니다.",
                        summary.atRiskPatients() > 0 ? "warning" : "normal",
                        summary.atRiskPatients()),
                new AdminDashboardResponse.DashboardAlert(
                        "MISSING_PROFILE",
                        "프로필 미등록 보호자",
                        "보호자 계정은 있으나 환자 프로필이 아직 없습니다.",
                        missingProfiles > 0 ? "warning" : "normal",
                        missingProfiles),
                new AdminDashboardResponse.DashboardAlert(
                        "CONTENT_SKEW",
                        "콘텐츠 편중 사용",
                        "한 콘텐츠가 전체 콘텐츠 사용시간의 80% 이상인 환자입니다.",
                        contentSkewedPatients > 0 ? "info" : "normal",
                        contentSkewedPatients));
    }

    private static String contentLabel(ContentType type) {
        return switch (type) {
            case LOGIN -> "접속";
            case ART -> "미술";
            case MUSIC -> "음악";
            case TAEKWONDO -> "태권도";
            case GYMNASTICS -> "체조";
        };
    }

    private static final class PatientUsage {
        private final UsageTotals total = new UsageTotals();
        private long todaySeconds;
        private LocalDate lastActiveDate;

        private PatientUsage() {}

        private void add(ContentType type, long seconds) {
            total.add(type, seconds);
        }

        private void markActive(LocalDate date) {
            if (lastActiveDate == null || lastActiveDate.isBefore(date)) {
                lastActiveDate = date;
            }
        }

        private String favoriteContentLabel() {
            ContentType favorite = total.favoriteContent();
            return favorite != null ? contentLabel(favorite) : "없음";
        }

        private String status(LocalDate periodTo) {
            if (lastActiveDate == null || !total.hasAnyUsage()) {
                return "RISK";
            }
            if (lastActiveDate.isBefore(periodTo.minusDays(RISK_INACTIVE_DAYS - 1L))) {
                return "RISK";
            }
            if (todaySeconds > 0 || total.appUsageSeconds() >= ACTIVE_PERIOD_SECONDS_THRESHOLD) {
                return "ACTIVE";
            }
            return "NORMAL";
        }

        private boolean isContentSkewed() {
            long contentTotal = total.contentTotal();
            if (contentTotal < CONTENT_SKEW_MIN_SECONDS) {
                return false;
            }
            long max =
                    Math.max(
                            Math.max(total.art, total.music),
                            Math.max(total.taekwondo, total.gymnastics));
            return max * 100 >= contentTotal * CONTENT_SKEW_PERCENT_THRESHOLD;
        }
    }

    private static final class UsageTotals {
        private long login;
        private long art;
        private long music;
        private long taekwondo;
        private long gymnastics;

        private UsageTotals() {}

        private void add(ContentType type, long seconds) {
            switch (type) {
                case LOGIN -> login += seconds;
                case ART -> art += seconds;
                case MUSIC -> music += seconds;
                case TAEKWONDO -> taekwondo += seconds;
                case GYMNASTICS -> gymnastics += seconds;
            }
        }

        private long get(ContentType type) {
            return switch (type) {
                case LOGIN -> login;
                case ART -> art;
                case MUSIC -> music;
                case TAEKWONDO -> taekwondo;
                case GYMNASTICS -> gymnastics;
            };
        }

        private long total() {
            return login + art + music + taekwondo + gymnastics;
        }

        private long appUsageSeconds() {
            return login;
        }

        private long contentTotal() {
            return art + music + taekwondo + gymnastics;
        }

        private boolean hasAnyUsage() {
            return total() > 0;
        }

        private ContentType favoriteContent() {
            Map<ContentType, Long> contents = new EnumMap<>(ContentType.class);
            contents.put(ContentType.ART, art);
            contents.put(ContentType.MUSIC, music);
            contents.put(ContentType.TAEKWONDO, taekwondo);
            contents.put(ContentType.GYMNASTICS, gymnastics);
            return contents.entrySet().stream()
                    .filter(entry -> entry.getValue() > 0)
                    .max(Map.Entry.comparingByValue())
                    .map(Map.Entry::getKey)
                    .orElse(null);
        }
    }
}
