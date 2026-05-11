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
        return issueToken(gameTokenCommand(session));
    }

    public LiveKitTokenResponse issueGuardianToken(Long userId, Long loginSessionId) {
        LoginSession session = findActiveOwnedSession(userId, loginSessionId);
        return issueToken(guardianTokenCommand(userId, session));
    }

    private LoginSession findActiveOwnedSession(Long userId, Long loginSessionId) {
        LoginSession session = loginSessionService.findOwnedOrThrow(userId, loginSessionId);
        if (session.isEnded()) {
            throw new BusinessException(RealtimeErrorCode.LOGIN_SESSION_ALREADY_ENDED);
        }
        return session;
    }

    private LiveKitTokenResponse issueToken(TokenIssueCommand command) {
        liveKitProperties.validateConfigured();

        AccessToken token =
                new AccessToken(liveKitProperties.apiKey(), liveKitProperties.apiSecret());
        token.setIdentity(command.participantIdentity());
        token.setName(command.participantName());
        token.setTtl(TOKEN_TTL_MILLIS);
        token.addGrants(
                new RoomJoin(true),
                new RoomName(command.roomName()),
                new CanPublish(command.canPublish()),
                new CanSubscribe(true),
                new CanPublishData(command.canPublishData()));
        String jwt = createJwt(token, command.roomName(), command.participantIdentity());

        return new LiveKitTokenResponse(
                command.loginSessionId(),
                command.patientProfileId(),
                command.roomName(),
                liveKitProperties.url(),
                command.participantIdentity(),
                command.participantName(),
                jwt,
                TOKEN_TTL_SECONDS,
                command.contentActive(),
                command.contentType());
    }

    private static TokenIssueCommand gameTokenCommand(LoginSession session) {
        long loginSessionId = session.getId();
        long patientProfileId = session.getPatientProfile().getId();
        String roomName = roomName(patientProfileId, loginSessionId);
        ContentState contentState = inactiveContentState();

        return new TokenIssueCommand(
                loginSessionId,
                patientProfileId,
                roomName,
                "game-patient-%d-login-%d".formatted(patientProfileId, loginSessionId),
                "game",
                true,
                true,
                contentState.active(),
                contentState.type());
    }

    private static TokenIssueCommand guardianTokenCommand(Long userId, LoginSession session) {
        long loginSessionId = session.getId();
        long patientProfileId = session.getPatientProfile().getId();
        String roomName = roomName(patientProfileId, loginSessionId);
        ContentState contentState = inactiveContentState();

        return new TokenIssueCommand(
                loginSessionId,
                patientProfileId,
                roomName,
                "guardian-user-%d-login-%d".formatted(userId, loginSessionId),
                "guardian",
                false,
                false,
                contentState.active(),
                contentState.type());
    }

    private static ContentState inactiveContentState() {
        // TODO(S14P31E103-629): 콘텐츠 라이프사이클 상태와 연동되면 실제 진행 상태로 교체한다.
        return new ContentState(false, null);
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

    private static String roomName(long patientProfileId, long loginSessionId) {
        return "patient-%d-login-%d".formatted(patientProfileId, loginSessionId);
    }

    private record TokenIssueCommand(
            long loginSessionId,
            long patientProfileId,
            String roomName,
            String participantIdentity,
            String participantName,
            boolean canPublish,
            boolean canPublishData,
            boolean contentActive,
            String contentType) {}

    private record ContentState(boolean active, String type) {}
}
