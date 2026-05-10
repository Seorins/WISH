package com.comong.backend.domain.realtime.service;

import java.io.IOException;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.comong.backend.domain.realtime.dto.RealtimeEventResponse;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class RealtimeEventService {

    private static final long SSE_TIMEOUT_MILLIS = 30 * 60 * 1000L;
    private static final String EVENT_NAME = "realtime";

    private final ConcurrentHashMap<Long, Set<SseEmitter>> emittersByUserId =
            new ConcurrentHashMap<>();

    public SseEmitter subscribe(Long userId) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MILLIS);
        register(userId, emitter);
        sendOrRemove(userId, emitter, RealtimeEventResponse.connected());
        return emitter;
    }

    public void publish(Long userId, RealtimeEventResponse event) {
        Set<SseEmitter> emitters = emittersByUserId.get(userId);
        if (emitters == null || emitters.isEmpty()) {
            return;
        }
        emitters.forEach(emitter -> sendOrRemove(userId, emitter, event));
    }

    int activeEmitterCount(Long userId) {
        Set<SseEmitter> emitters = emittersByUserId.get(userId);
        return emitters == null ? 0 : emitters.size();
    }

    private void register(Long userId, SseEmitter emitter) {
        emittersByUserId
                .computeIfAbsent(userId, ignored -> new CopyOnWriteArraySet<>())
                .add(emitter);
        emitter.onCompletion(() -> remove(userId, emitter));
        emitter.onTimeout(() -> remove(userId, emitter));
        emitter.onError(error -> remove(userId, emitter));
    }

    private void sendOrRemove(Long userId, SseEmitter emitter, RealtimeEventResponse event) {
        try {
            emitter.send(SseEmitter.event().name(EVENT_NAME).data(event));
        } catch (IOException | IllegalStateException e) {
            log.debug("SSE send failed. userId={}, eventType={}", userId, event.type(), e);
            remove(userId, emitter);
        }
    }

    private void remove(Long userId, SseEmitter emitter) {
        Set<SseEmitter> emitters = emittersByUserId.get(userId);
        if (emitters == null) {
            return;
        }
        emitters.remove(emitter);
        if (emitters.isEmpty()) {
            emittersByUserId.remove(userId, emitters);
        }
    }
}
