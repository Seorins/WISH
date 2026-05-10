package com.comong.backend.domain.realtime.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import com.comong.backend.domain.realtime.dto.RealtimeEventResponse;
import com.comong.backend.domain.realtime.dto.RealtimeEventType;

class RealtimeEventServiceTest {

    @Test
    void subscribe_registersEmitter() {
        RealtimeEventService service = new RealtimeEventService();

        service.subscribe(1L);

        assertThat(service.activeEmitterCount(1L)).isEqualTo(1);
    }

    @Test
    void subscribe_supportsMultipleEmittersForSameUser() {
        RealtimeEventService service = new RealtimeEventService();

        service.subscribe(1L);
        service.subscribe(1L);

        assertThat(service.activeEmitterCount(1L)).isEqualTo(2);
    }

    @Test
    void publish_withoutSubscriber_isNoOp() {
        RealtimeEventService service = new RealtimeEventService();

        service.publish(
                1L, RealtimeEventResponse.of(RealtimeEventType.GAME_STARTED, 10L, 20L, null));

        assertThat(service.activeEmitterCount(1L)).isZero();
    }
}
