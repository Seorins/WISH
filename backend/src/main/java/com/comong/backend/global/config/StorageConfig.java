package com.comong.backend.global.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import com.comong.backend.global.storage.StorageProperties;

import lombok.RequiredArgsConstructor;

/**
 * 로컬 스토리지에 저장된 업로드 파일을 정적 리소스로 서빙하기 위한 설정.
 *
 * <p>{@link StorageProperties#publicUrlPrefix()} 경로로 들어오는 요청을 OS 파일시스템의 {@link
 * StorageProperties#uploadDir()} 디렉토리로 매핑한다. 운영에서 S3/CDN 으로 갈아끼울 경우 본 설정은 비활성화하고 별도 구현체로 교체한다.
 *
 * <p><b>보안 주의</b>: 이 핸들러로 매핑된 모든 파일은 누구나 URL 만 알면 접근 가능하다. 비공개 작품 이미지 접근 제어가 필요하면 인증된 컨트롤러로 다운로드
 * 경로를 분리해야 하며, 그 경우 {@link com.comong.backend.global.config.SecurityConfig#PUBLIC_ENDPOINTS} 에서도
 * {@code /uploads/**} 항목을 제거해야 한다.
 */
@Configuration
@RequiredArgsConstructor
@EnableConfigurationProperties(StorageProperties.class)
public class StorageConfig implements WebMvcConfigurer {

    private final StorageProperties properties;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String handlerPattern = stripTrailingSlash(properties.publicUrlPrefix()) + "/**";
        String location = "file:" + ensureTrailingSlash(properties.uploadDir());
        registry.addResourceHandler(handlerPattern).addResourceLocations(location);
    }

    private static String stripTrailingSlash(String s) {
        return s.endsWith("/") ? s.substring(0, s.length() - 1) : s;
    }

    private static String ensureTrailingSlash(String s) {
        return s.endsWith("/") ? s : s + "/";
    }
}
