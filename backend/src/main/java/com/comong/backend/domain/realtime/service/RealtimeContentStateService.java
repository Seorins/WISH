package com.comong.backend.domain.realtime.service;

import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Service;

import com.comong.backend.domain.usage.entity.ContentType;

@Service
public class RealtimeContentStateService {

    private final ConcurrentHashMap<Long, ContentType> activeContentByLoginSessionId =
            new ConcurrentHashMap<>();

    public ContentState find(Long loginSessionId) {
        ContentType contentType = activeContentByLoginSessionId.get(loginSessionId);
        return ContentState.from(contentType);
    }

    public ContentChange start(Long loginSessionId, ContentType contentType) {
        ContentType previous = activeContentByLoginSessionId.put(loginSessionId, contentType);
        return new ContentChange(previous, contentType);
    }

    public Optional<ContentType> end(Long loginSessionId) {
        return Optional.ofNullable(activeContentByLoginSessionId.remove(loginSessionId));
    }

    public void clear(Long loginSessionId) {
        activeContentByLoginSessionId.remove(loginSessionId);
    }

    public record ContentState(boolean active, ContentType contentType) {

        private static ContentState from(ContentType contentType) {
            return new ContentState(contentType != null, contentType);
        }

        public String contentTypeName() {
            return contentType == null ? null : contentType.name();
        }
    }

    public record ContentChange(ContentType previousContentType, ContentType currentContentType) {

        public boolean changed() {
            return previousContentType != currentContentType;
        }
    }
}
