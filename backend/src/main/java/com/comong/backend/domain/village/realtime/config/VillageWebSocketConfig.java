package com.comong.backend.domain.village.realtime.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import com.comong.backend.domain.village.realtime.handler.VillageStompAuthInterceptor;

import lombok.RequiredArgsConstructor;

/**
 * 마을 광장 WebSocket/STOMP 설정.
 *
 * <ul>
 *   <li>핸드셰이크 엔드포인트: {@code /ws/village} (context-path 포함 시 {@code /api/v1/ws/village})
 *   <li>app prefix: {@code /app} — 클라이언트가 서버로 보내는 메시지 ({@code @MessageMapping})
 *   <li>broker prefix: {@code /topic} (1:N 브로드캐스트), {@code /queue} (1:1)
 *   <li>user prefix: {@code /user} — 특정 사용자 큐 라우팅 ({@code @SendToUser})
 *   <li>인메모리 SimpleBroker — 단일 인스턴스 운영 전제. 멀티 인스턴스 시 RabbitMQ/Redis StompBrokerRelay 로 교체.
 * </ul>
 *
 * <p>인증은 {@link VillageStompAuthInterceptor} 가 CONNECT 프레임에서 수행. HTTP 핸드셰이크 자체는 SecurityConfig 가
 * permit (계획서 14절 결정).
 */
@Configuration
@EnableWebSocketMessageBroker
@EnableConfigurationProperties(VillageRealtimeProperties.class)
@RequiredArgsConstructor
public class VillageWebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final VillageStompAuthInterceptor stompAuthInterceptor;

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws/village");
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic", "/queue");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(stompAuthInterceptor);
    }
}
