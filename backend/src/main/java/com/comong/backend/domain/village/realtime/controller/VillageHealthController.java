package com.comong.backend.domain.village.realtime.controller;

import java.security.Principal;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.stereotype.Controller;

/**
 * S14P31E103-714 STOMP 인프라 스모크 테스트용 컨트롤러.
 *
 * <p>인증된 STOMP 세션에서 {@code /app/village/ping} 으로 발행하면, 발행자 큐 {@code /user/queue/village.pong} 으로
 * echo 응답을 받는다. presence/relay 가 들어오는 S14P31E103-715 머지 시점에 삭제.
 */
@Controller
public class VillageHealthController {

    @MessageMapping("/village/ping")
    @SendToUser("/queue/village.pong")
    public String ping(Principal principal, @Payload(required = false) String payload) {
        String userId = principal != null ? principal.getName() : "anonymous";
        return "pong:" + userId + ":" + (payload != null ? payload : "");
    }
}
