package com.comong.backend.domain.admin.dto;

import java.time.LocalDate;
import java.util.List;

public record AdminDashboardResponse(
        LocalDate from,
        LocalDate to,
        Summary summary,
        List<DailyUsage> dailyUsage,
        List<ContentShare> contentShares,
        List<PatientActivity> patientActivities,
        List<DashboardAlert> alerts) {

    public record Summary(
            long totalUsers,
            long guardianUsers,
            long adminUsers,
            long totalPatients,
            long todayActivePatients,
            long todayTotalSeconds,
            long periodTotalSeconds,
            long averageDailySeconds,
            long atRiskPatients,
            long newUsersToday,
            long newPatientsToday) {}

    public record DailyUsage(
            LocalDate date,
            long login,
            long art,
            long music,
            long taekwondo,
            long gymnastics,
            long total,
            long activePatients) {}

    public record ContentShare(
            String contentType, String label, long totalSeconds, double percentage) {}

    public record PatientActivity(
            long patientId,
            String patientName,
            String patientNickname,
            String guardianEmail,
            long todaySeconds,
            long periodSeconds,
            String favoriteContent,
            LocalDate lastActiveDate,
            String status) {}

    public record DashboardAlert(
            String type, String title, String description, String severity, long count) {}
}
