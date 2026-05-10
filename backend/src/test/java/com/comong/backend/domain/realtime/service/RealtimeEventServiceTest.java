package com.comong.backend.domain.realtime.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

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

    @Test
    void publish_oneEmitterFails_keepsDeliveringToOtherEmitters() {
        TestRealtimeEventService service = new TestRealtimeEventService(new AtomicLong(0));
        service.subscribe(1L);
        TestSseEmitter failing = service.createdEmitters().get(0);
        service.subscribe(1L);
        TestSseEmitter healthy = service.createdEmitters().get(1);
        failing.failOnSend();

        service.publish(
                1L, RealtimeEventResponse.of(RealtimeEventType.GAME_STARTED, 10L, 20L, null));

        assertThat(service.activeEmitterCount(1L)).isEqualTo(1);
        assertThat(healthy.sendCount()).isEqualTo(2);
    }

    @Test
    void publish_oneEmitterThrowsRuntimeException_keepsDeliveringToOtherEmitters() {
        TestRealtimeEventService service = new TestRealtimeEventService(new AtomicLong(0));
        service.subscribe(1L);
        TestSseEmitter failing = service.createdEmitters().get(0);
        service.subscribe(1L);
        TestSseEmitter healthy = service.createdEmitters().get(1);
        failing.failOnRuntimeException();

        service.publish(
                1L, RealtimeEventResponse.of(RealtimeEventType.GAME_STARTED, 10L, 20L, null));

        assertThat(service.activeEmitterCount(1L)).isEqualTo(1);
        assertThat(healthy.sendCount()).isEqualTo(2);
    }

    @Test
    void cleanupExpiredEmitters_removesOldEmitters() {
        AtomicLong nowMillis = new AtomicLong(0);
        TestRealtimeEventService service = new TestRealtimeEventService(nowMillis);
        service.subscribe(1L);
        TestSseEmitter emitter = service.createdEmitters().get(0);

        nowMillis.set(31 * 60 * 1000L);
        service.cleanupExpiredEmitters();

        assertThat(service.activeEmitterCount(1L)).isZero();
        assertThat(emitter.completeCount()).isEqualTo(1);
    }

    private static final class TestRealtimeEventService extends RealtimeEventService {

        private final List<TestSseEmitter> createdEmitters = new ArrayList<>();

        private TestRealtimeEventService(AtomicLong nowMillis) {
            super(nowMillis::get);
        }

        @Override
        SseEmitter createEmitter() {
            TestSseEmitter emitter = new TestSseEmitter();
            createdEmitters.add(emitter);
            return emitter;
        }

        private List<TestSseEmitter> createdEmitters() {
            return createdEmitters;
        }
    }

    private static final class TestSseEmitter extends SseEmitter {

        private int sendCount;
        private int completeCount;
        private boolean failOnSend;
        private boolean failOnRuntimeException;

        private TestSseEmitter() {
            super(30 * 60 * 1000L);
        }

        @Override
        public void send(SseEventBuilder builder) throws IOException {
            if (failOnSend) {
                throw new IOException("forced failure");
            }
            if (failOnRuntimeException) {
                throw new IllegalStateException("forced failure");
            }
            sendCount++;
        }

        @Override
        public void complete() {
            completeCount++;
        }

        private void failOnSend() {
            failOnSend = true;
        }

        private void failOnRuntimeException() {
            failOnRuntimeException = true;
        }

        private int sendCount() {
            return sendCount;
        }

        private int completeCount() {
            return completeCount;
        }
    }
}
