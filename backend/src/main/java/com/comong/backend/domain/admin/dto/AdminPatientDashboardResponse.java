package com.comong.backend.domain.admin.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import com.comong.backend.domain.patient.entity.Gender;

public record AdminPatientDashboardResponse(
        LocalDate from,
        LocalDate to,
        Patient patient,
        Summary summary,
        List<DailyUsage> dailyUsage,
        List<AdminDashboardResponse.ContentShare> contentShares) {

    public record Patient(
            long patientId,
            String patientName,
            String patientNickname,
            Gender gender,
            LocalDate birthDate,
            LocalDateTime createdAt,
            String guardianEmail) {}

    public record Summary(
            long todaySeconds,
            long periodSeconds,
            long contentSeconds,
            long averageDailySeconds,
            long activeDays,
            LocalDate lastActiveDate,
            String status,
            String favoriteContent,
            boolean contentSkewed,
            int riskInactiveDays) {}

    public record DailyUsage(
            LocalDate date,
            long login,
            long art,
            long music,
            long taekwondo,
            long gymnastics,
            long total,
            boolean active) {}
}
