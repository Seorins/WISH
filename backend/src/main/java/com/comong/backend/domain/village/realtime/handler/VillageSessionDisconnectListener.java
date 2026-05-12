package com.comong.backend.domain.village.realtime.handler;

import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import com.comong.backend.domain.village.realtime.service.VillagePresenceService;

import lombok.RequiredArgsConstructor;

/**
 * WebSocket 세션이 끊길 때 ({@link SessionDisconnectEvent}) 마을 광장 presence 에서 해당 세션을 제거한다.
 *
 * <p>정상 disconnect (탭 닫기, 명시적 logout) 와 비정상 disconnect (네트워크 끊김) 모두 동일 이벤트로 도달한다. 이벤트가 유실되는 극단 경우엔
 * {@link com.comong.backend.domain.village.realtime.scheduler.VillageIdleCleanupScheduler} 의 idle
 * TTL 정리가 백업.
 */
@Component
@RequiredArgsConstructor
public class VillageSessionDisconnectListener {

    private final VillagePresenceService presenceService;

    @EventListener
    public void onSessionDisconnect(SessionDisconnectEvent event) {
        String sessionId = event.getSessionId();
        if (sessionId == null) {
            return;
        }
        presenceService.leaveBySession(sessionId);
    }
}
