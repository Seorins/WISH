package com.comong.backend.global.storage;

/**
 * {@link ImageStorage#upload} 의 결과. 외부 노출용 URL 만 담는다.
 *
 * <p>URL 형식은 구현체 / {@link StorageProperties#publicUrlPrefix()} 에 따라 다르다. 로컬 구현은 servlet 상대 경로(예:
 * {@code /uploads/{uuid}.png})를 반환한다.
 */
public record StoredImage(String url) {}
