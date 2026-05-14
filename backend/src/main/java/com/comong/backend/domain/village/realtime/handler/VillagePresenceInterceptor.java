package com.comong.backend.domain.village.realtime.handler;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import com.comong.backend.domain.village.realtime.exception.VillagePatientProfileMissingException;
import com.comong.backend.domain.village.realtime.exception.VillageRoomFullException;
import com.comong.backend.domain.village.realtime.service.VillagePresenceService;

import lombok.RequiredArgsConstructor;

/**
 * STOMP CONNECT 단계에서 지정 룸에 presence 를 등록한다.
 *
 * <p>S14P31E103-793: 클라가 {@code Room} 네이티브 헤더로 룸 ID 를 전달한다 (예: {@code village.default}, {@code
 * gymnastics.select}). 헤더가 없으면 {@code village.default} 로 fallback — 기존 단일-룸 클라이언트 호환.
 *
 * <p>{@link VillageStompAuthInterceptor} 가 먼저 실행되어 {@link VillageStompPrincipal} 을 주입한 상태를 전제로 한다 —
 * {@link
 * com.comong.backend.domain.village.realtime.config.VillageWebSocketConfig#configureClientInboundChannel}
 * 에서 등록 순서가 보장된다.
 *
 * <p>실패 시 {@link MessagingException} 으로 래핑해 STOMP ERROR 프레임이 클라에 전달된다.
 */
@Component
@RequiredArgsConstructor
public class VillagePresenceInterceptor implements ChannelInterceptor {

    private static final String ROOM_HEADER = "Room";

    /** 기존 단일-룸 클라이언트 / 테스트 호환용. 신규 클라는 명시 권장. */
    private static final String DEFAULT_ROOM_ID = "village.default";

    private final VillagePresenceService presenceService;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor =
                MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || !StompCommand.CONNECT.equals(accessor.getCommand())) {
            return message;
        }

        if (!(accessor.getUser() instanceof VillageStompPrincipal principal)) {
            throw new MessagingException(message, "presence: authenticated principal missing");
        }
        String sessionId = accessor.getSessionId();
        if (sessionId == null) {
            throw new MessagingException(message, "presence: STOMP sessionId missing");
        }

        String roomId = resolveRoomId(accessor);

        try {
            presenceService.join(sessionId, principal.userId(), roomId);
        } catch (VillageRoomFullException | VillagePatientProfileMissingException e) {
            throw new MessagingException(message, e.getMessage(), e);
        }
        return message;
    }

    private static String resolveRoomId(StompHeaderAccessor accessor) {
        String header = accessor.getFirstNativeHeader(ROOM_HEADER);
        return StringUtils.hasText(header) ? header : DEFAULT_ROOM_ID;
    }
}
