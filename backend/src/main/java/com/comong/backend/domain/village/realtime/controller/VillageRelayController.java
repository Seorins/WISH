package com.comong.backend.domain.village.realtime.controller;

import java.security.Principal;
import java.time.Instant;

import jakarta.validation.Valid;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

import com.comong.backend.domain.village.realtime.dto.EmotePacket;
import com.comong.backend.domain.village.realtime.dto.PositionPacket;
import com.comong.backend.domain.village.realtime.dto.VillageSnapshot;
import com.comong.backend.domain.village.realtime.handler.VillageStompPrincipal;
import com.comong.backend.domain.village.realtime.service.VillageBroadcastService;
import com.comong.backend.domain.village.realtime.service.VillageEmojis;
import com.comong.backend.domain.village.realtime.service.VillagePresenceService;

import lombok.RequiredArgsConstructor;

/**
 * 마을 광장 메시지 라우팅. 두 endpoint:
 *
 * <ul>
 *   <li>{@code /app/village/ready} — 클라가 구독을 완료하고 스냅샷을 받을 준비가 됐다는 신호. 서버는 1) 현재 멤버 전원의 스냅샷을 호출자에게
 *       전송, 2) 호출자의 입장을 토픽에 broadcast.
 *   <li>{@code /app/village/position} — 클라가 자기 위치를 5Hz 주기로 발행. 서버는 presence 갱신 후 토픽에 move 이벤트
 *       broadcast.
 * </ul>
 *
 * <p>presence 등록 자체는 STOMP CONNECT 시점에 {@code VillagePresenceInterceptor} 가 처리 (S14P31E103-717). 이
 * 컨트롤러는 그 이후 단계만 책임진다.
 */
@Controller
@RequiredArgsConstructor
public class VillageRelayController {

    private final VillagePresenceService presenceService;
    private final VillageBroadcastService broadcastService;

    @MessageMapping("/village/ready")
    public void onReady(Principal principal) {
        if (!(principal instanceof VillageStompPrincipal vsp)) {
            return;
        }
        presenceService
                .findByUserId(vsp.userId())
                .ifPresent(
                        member -> {
                            broadcastService.sendSnapshot(
                                    principal.getName(),
                                    VillageSnapshot.of(presenceService.members()));
                            broadcastService.broadcastJoin(member);
                        });
    }

    @MessageMapping("/village/position")
    public void onPosition(@Valid @Payload PositionPacket packet, Principal principal) {
        if (!(principal instanceof VillageStompPrincipal vsp)) {
            return;
        }
        presenceService
                .updatePosition(vsp.userId(), packet.x(), packet.y(), packet.dir())
                .ifPresent(member -> broadcastService.broadcastMove(member, packet.moving()));
    }

    /**
     * 이모티콘 발신. 화이트리스트 + 서버측 throttle (2s) 통과 시 토픽에 emote 이벤트 broadcast. 거부 시 조용히 drop — 클라에 ERROR
     * 프레임 안 보냄 (도배 / 위조 시도가 사용자 응답으로 가지 않도록).
     */
    @MessageMapping("/village/emote")
    public void onEmote(@Valid @Payload EmotePacket packet, Principal principal) {
        if (!(principal instanceof VillageStompPrincipal vsp)) {
            return;
        }
        if (!VillageEmojis.isAllowed(packet.emoji())) {
            return;
        }
        presenceService
                .registerEmote(vsp.userId(), Instant.now())
                .ifPresent(member -> broadcastService.broadcastEmote(member, packet.emoji()));
    }
}
