package com.comong.backend.global.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 로컬 이미지 스토리지 설정. {@code application.yaml} 의 {@code storage.local.*} 값을 바인딩한다.
 *
 * <ul>
 *   <li>{@code uploadDir}: 업로드 파일이 실제로 저장되는 OS 경로 (절대 또는 상대). 디렉토리는 첫 업로드 시점에 lazy 하게 생성된다.
 *   <li>{@code publicUrlPrefix}: 외부 노출 URL 의 servlet 상대 prefix (예: {@code /uploads}). {@link
 *       LocalImageStorage} 는 prefix + "/" + UUID 파일명 형태로 URL 을 만들고, {@link
 *       com.comong.backend.global.config.StorageConfig} 는 같은 prefix 패턴을 정적 리소스 핸들러에 매핑한다.
 * </ul>
 */
@ConfigurationProperties(prefix = "storage.local")
public record StorageProperties(String uploadDir, String publicUrlPrefix) {}
