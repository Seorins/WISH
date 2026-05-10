package com.comong.backend.domain.realtime.service;

import java.io.IOException;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.function.LongSupplier;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.comong.backend.domain.realtime.dto.RealtimeEventResponse;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class RealtimeEventService {

    private static final long SSE_TIMEOUT_MILLIS = 30 * 60 * 1000L;
    private static final String EVENT_NAME = "realtime";

    private final ConcurrentHashMap<Long, Set<EmitterRegistration>> emittersByUserId =
            new ConcurrentHashMap<>();
    private final LongSupplier nowMillis;

    public RealtimeEventService() {
        this(System::currentTimeMillis);
    }

    RealtimeEventService(LongSupplier nowMillis) {
        this.nowMillis = nowMillis;
    }

    public SseEmitter subscribe(Long userId) {
        SseEmitter emitter = createEmitter();
        EmitterRegistration registration = new EmitterRegistration(emitter, nowMillis.getAsLong());
        register(userId, registration);
        sendOrRemove(userId, registration, RealtimeEventResponse.connected());
        return emitter;
    }

    public void publish(Long userId, RealtimeEventResponse event) {
        Set<EmitterRegistration> emitters = emittersByUserId.get(userId);
        if (emitters == null || emitters.isEmpty()) {
            return;
        }
        emitters.forEach(registration -> sendOrRemove(userId, registration, event));
    }

    @Scheduled(fixedDelayString = "${realtime.sse.cleanup-interval-millis:60000}")
    public void cleanupExpiredEmitters() {
        long now = nowMillis.getAsLong();
        emittersByUserId.forEach(
                (userId, registrations) ->
                        registrations.forEach(
                                registration -> {
                                    if (now - registration.registeredAtMillis()
                                            >= SSE_TIMEOUT_MILLIS) {
                                        registration.emitter().complete();
                                        remove(userId, registration);
                                    }
                                }));
    }

    int activeEmitterCount(Long userId) {
        Set<EmitterRegistration> emitters = emittersByUserId.get(userId);
        return emitters == null ? 0 : emitters.size();
    }

    SseEmitter createEmitter() {
        return new SseEmitter(SSE_TIMEOUT_MILLIS);
    }

    private void register(Long userId, EmitterRegistration registration) {
        emittersByUserId.compute(
                userId,
                (ignored, current) -> {
                    Set<EmitterRegistration> registrations =
                            current == null ? new CopyOnWriteArraySet<>() : current;
                    registrations.add(registration);
                    return registrations;
                });
        registration.emitter().onCompletion(() -> remove(userId, registration));
        registration.emitter().onTimeout(() -> remove(userId, registration));
        registration.emitter().onError(error -> remove(userId, registration));
    }

    private void sendOrRemove(
            Long userId, EmitterRegistration registration, RealtimeEventResponse event) {
        try {
            registration.emitter().send(SseEmitter.event().name(EVENT_NAME).data(event));
        } catch (IOException | RuntimeException e) {
            log.debug("SSE send failed. userId={}, eventType={}", userId, event.type(), e);
            remove(userId, registration);
        }
    }

    private void remove(Long userId, EmitterRegistration registration) {
        emittersByUserId.computeIfPresent(
                userId,
                (ignored, current) -> {
                    current.remove(registration);
                    return current.isEmpty() ? null : current;
                });
    }

    private record EmitterRegistration(SseEmitter emitter, long registeredAtMillis) {}
}
