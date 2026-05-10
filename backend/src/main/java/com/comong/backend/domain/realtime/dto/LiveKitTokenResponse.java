package com.comong.backend.domain.realtime.dto;

import io.swagger.v3.oas.annotations.media.Schema;

public record LiveKitTokenResponse(
        @Schema(description = "LiveKit 서버 URL") String serverUrl,
        @Schema(description = "LiveKit 룸 이름") String roomName,
        @Schema(description = "LiveKit 참가자 identity") String participantIdentity,
        @Schema(description = "LiveKit 참가자 표시 이름") String participantName,
        @Schema(description = "LiveKit 입장 토큰") String token,
        @Schema(description = "토큰 유효 시간 (초)") long expiresInSeconds) {}
