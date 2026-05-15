package com.comong.backend.domain.gomoku.dto;

import com.comong.backend.domain.patient.entity.PatientProfile;

public record GomokuPlayerResponse(Long patientProfileId, String nickname) {
    public static GomokuPlayerResponse from(PatientProfile patientProfile) {
        if (patientProfile == null) {
            return null;
        }
        return new GomokuPlayerResponse(patientProfile.getId(), patientProfile.getNickname());
    }
}
