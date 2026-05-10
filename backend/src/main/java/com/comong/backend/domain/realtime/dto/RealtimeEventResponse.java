package com.comong.backend.domain.realtime.dto;

import java.time.LocalDateTime;

import io.swagger.v3.oas.annotations.media.Schema;

public record RealtimeEventResponse(
        @Schema(description = "실시간 이벤트 타입") RealtimeEventType type,
        @Schema(description = "접속 세션 ID") Long loginSessionId,
        @Schema(description = "환자 프로필 ID") Long patientProfileId,
        @Schema(description = "콘텐츠 타입 (music/gymnastics/taekwondo/art 등)") String contentType,
        @Schema(description = "이벤트 발생 시각") LocalDateTime occurredAt) {

    public static RealtimeEventResponse connected() {
        return new RealtimeEventResponse(
                RealtimeEventType.CONNECTED, null, null, null, LocalDateTime.now());
    }

    public static RealtimeEventResponse of(
            RealtimeEventType type,
            Long loginSessionId,
            Long patientProfileId,
            String contentType) {
        return new RealtimeEventResponse(
                type, loginSessionId, patientProfileId, contentType, LocalDateTime.now());
    }
}
