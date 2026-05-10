package com.comong.backend.domain.realtime.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.comong.backend.domain.realtime.config.LiveKitProperties;
import com.comong.backend.domain.realtime.dto.LiveKitTokenResponse;
import com.comong.backend.domain.realtime.exception.RealtimeErrorCode;
import com.comong.backend.domain.usage.entity.LoginSession;
import com.comong.backend.domain.usage.service.LoginSessionService;
import com.comong.backend.global.exception.BusinessException;

import io.livekit.server.AccessToken;
import io.livekit.server.CanPublish;
import io.livekit.server.CanPublishData;
import io.livekit.server.CanSubscribe;
import io.livekit.server.RoomJoin;
import io.livekit.server.RoomName;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RealtimeTokenService {

    private static final long TOKEN_TTL_SECONDS = 3600;
    private static final long TOKEN_TTL_MILLIS = TOKEN_TTL_SECONDS * 1000;

    private final LoginSessionService loginSessionService;
    private final LiveKitProperties liveKitProperties;

    public LiveKitTokenResponse issueGameToken(Long userId, Long loginSessionId) {
        LoginSession session = findActiveOwnedSession(userId, loginSessionId);
        Long patientProfileId = session.getPatientProfile().getId();
        String roomName = roomName(patientProfileId, session.getId());
        String identity = "game-patient-%d-login-%d".formatted(patientProfileId, session.getId());
        return issueToken(roomName, identity, "game", true, true);
    }

    public LiveKitTokenResponse issueGuardianToken(Long userId, Long loginSessionId) {
        LoginSession session = findActiveOwnedSession(userId, loginSessionId);
        Long patientProfileId = session.getPatientProfile().getId();
        String roomName = roomName(patientProfileId, session.getId());
        String identity = "guardian-user-%d-login-%d".formatted(userId, session.getId());
        return issueToken(roomName, identity, "guardian", false, false);
    }

    private LoginSession findActiveOwnedSession(Long userId, Long loginSessionId) {
        LoginSession session = loginSessionService.findOwnedOrThrow(userId, loginSessionId);
        if (session.isEnded()) {
            throw new BusinessException(RealtimeErrorCode.LOGIN_SESSION_ALREADY_ENDED);
        }
        return session;
    }

    private LiveKitTokenResponse issueToken(
            String roomName,
            String participantIdentity,
            String participantName,
            boolean canPublish,
            boolean canPublishData) {
        liveKitProperties.validateConfigured();

        AccessToken token =
                new AccessToken(liveKitProperties.apiKey(), liveKitProperties.apiSecret());
        token.setIdentity(participantIdentity);
        token.setName(participantName);
        token.setTtl(TOKEN_TTL_MILLIS);
        token.addGrants(
                new RoomJoin(true),
                new RoomName(roomName),
                new CanPublish(canPublish),
                new CanSubscribe(true),
                new CanPublishData(canPublishData));
        String jwt = createJwt(token, roomName, participantIdentity);

        return new LiveKitTokenResponse(
                liveKitProperties.url(),
                roomName,
                participantIdentity,
                participantName,
                jwt,
                TOKEN_TTL_SECONDS);
    }

    private String createJwt(AccessToken token, String roomName, String participantIdentity) {
        try {
            return token.toJwt();
        } catch (RuntimeException e) {
            log.error(
                    "LiveKit token issue failed. roomName={}, participantIdentity={}",
                    roomName,
                    participantIdentity,
                    e);
            throw new BusinessException(RealtimeErrorCode.LIVEKIT_TOKEN_ISSUE_FAILED);
        }
    }

    private static String roomName(Long patientProfileId, Long loginSessionId) {
        return "patient-%d-login-%d".formatted(patientProfileId, loginSessionId);
    }
}
