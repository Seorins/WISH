package com.comong.backend.domain.notification.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

import com.comong.backend.domain.notification.entity.GuardianDeviceToken;
import com.comong.backend.domain.notification.repository.GuardianDeviceTokenRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class GuardianPushNotificationService {

    private static final String GAME_STARTED_TYPE = "GAME_STARTED";

    private final GuardianDeviceTokenRepository guardianDeviceTokenRepository;
    private final FirebasePushSender firebasePushSender;

    public void sendGameStarted(
            Long guardianUserId, Long loginSessionId, Long patientProfileId, String patientName) {
        List<GuardianDeviceToken> deviceTokens =
                guardianDeviceTokenRepository.findAllByUserIdAndActiveTrue(guardianUserId);
        if (deviceTokens.isEmpty()) {
            log.debug("No active guardian device token. userId={}", guardianUserId);
            return;
        }

        String title = "아이 활동이 시작됐어요";
        String body = patientName + "님의 게임 화면을 실시간으로 확인할 수 있어요.";
        String path = liveMonitorPath(loginSessionId, patientProfileId);
        Map<String, String> data =
                gameStartedData(loginSessionId, patientProfileId, patientName, path);

        for (GuardianDeviceToken deviceToken : deviceTokens) {
            FirebasePushResult result =
                    firebasePushSender.send(
                            new FirebasePushMessage(
                                    deviceToken.getDeviceToken(), title, body, data));
            if (result.invalidToken()) {
                int deactivated =
                        guardianDeviceTokenRepository.deactivateActiveById(deviceToken.getId());
                log.info(
                        "Invalid FCM token deactivated. deviceTokenId={}, failureCode={}, updatedRows={}",
                        deviceToken.getId(),
                        result.failureCode(),
                        deactivated);
            }
        }
    }

    private String liveMonitorPath(Long loginSessionId, Long patientProfileId) {
        return "/live?loginSessionId=" + loginSessionId + "&patientProfileId=" + patientProfileId;
    }

    private Map<String, String> gameStartedData(
            Long loginSessionId, Long patientProfileId, String patientName, String path) {
        Map<String, String> data = new LinkedHashMap<>();
        data.put("type", GAME_STARTED_TYPE);
        data.put("loginSessionId", String.valueOf(loginSessionId));
        data.put("patientProfileId", String.valueOf(patientProfileId));
        data.put("patientName", patientName == null ? "" : patientName);
        data.put("path", path);
        return data;
    }
}
