package com.comong.backend.domain.village.realtime.service;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import com.comong.backend.domain.village.realtime.dto.VillageEvent;
import com.comong.backend.domain.village.realtime.dto.VillageSnapshot;

import lombok.RequiredArgsConstructor;

/**
 * 마을 광장 토픽/큐 발행 어댑터. {@link SimpMessagingTemplate} 사용을 한 곳에 집중해서 토픽 이름/사용자 destination 규칙이 흩어지지 않게
 * 한다.
 */
@Service
@RequiredArgsConstructor
public class VillageBroadcastService {

    /** 단일 룸 가정. 멀티 룸 도입 시 토픽 suffix 파라미터화. */
    public static final String DEFAULT_ROOM_TOPIC = "/topic/village.default";

    /** 사용자 destination prefix 는 {@code /user} 가 자동 부여되므로 큐 이름만. */
    public static final String SNAPSHOT_QUEUE = "/queue/village.snapshot";

    private final SimpMessagingTemplate messagingTemplate;

    public void broadcastJoin(PlayerState member) {
        messagingTemplate.convertAndSend(DEFAULT_ROOM_TOPIC, VillageEvent.join(member));
    }

    public void broadcastMove(PlayerState member, boolean moving) {
        messagingTemplate.convertAndSend(DEFAULT_ROOM_TOPIC, VillageEvent.move(member, moving));
    }

    public void broadcastLeave(long userId) {
        messagingTemplate.convertAndSend(DEFAULT_ROOM_TOPIC, VillageEvent.leave(userId));
    }

    /**
     * 신규 입장자에게 현재 룸 스냅샷을 1회 전송.
     *
     * <p>{@code user} 는 {@link java.security.Principal#getName()} 값 — {@link
     * com.comong.backend.domain.village.realtime.handler.VillageStompPrincipal} 이 userId 문자열을 돌려준다.
     */
    public void sendSnapshot(String user, VillageSnapshot snapshot) {
        messagingTemplate.convertAndSendToUser(user, SNAPSHOT_QUEUE, snapshot);
    }
}
