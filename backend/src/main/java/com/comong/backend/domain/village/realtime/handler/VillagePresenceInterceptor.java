package com.comong.backend.domain.village.realtime.handler;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import com.comong.backend.domain.village.realtime.exception.VillagePatientProfileMissingException;
import com.comong.backend.domain.village.realtime.exception.VillageRoomFullException;
import com.comong.backend.domain.village.realtime.service.VillagePresenceService;

import lombok.RequiredArgsConstructor;

/**
 * STOMP CONNECT 단계에서 마을 광장 룸에 presence 를 등록한다.
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

        try {
            presenceService.join(sessionId, principal.userId());
        } catch (VillageRoomFullException | VillagePatientProfileMissingException e) {
            throw new MessagingException(message, e.getMessage(), e);
        }
        return message;
    }
}
