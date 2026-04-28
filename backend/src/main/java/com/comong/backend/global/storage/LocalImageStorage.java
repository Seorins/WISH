package com.comong.backend.global.storage;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import com.comong.backend.global.exception.BusinessException;
import com.comong.backend.global.exception.GlobalErrorCode;

/**
 * 로컬 디스크에 이미지를 저장하는 {@link ImageStorage} 구현체.
 *
 * <p>파일명 충돌 방지를 위해 UUID 기반 이름을 생성한다.
 *
 * <p><b>업로드 검증</b>:
 *
 * <ul>
 *   <li>{@code Content-Type} 이 {@code image/*} 인지 확인 (1차 — 클라이언트 헤더라 신뢰도 낮음)
 *   <li>원본 파일명의 확장자가 {@link #ALLOWED_EXTENSIONS} 에 포함되는지 검사 (2차 — HTML/SVG/실행파일 차단)
 * </ul>
 *
 * 두 검증 모두 클라이언트가 제공하는 메타데이터에 의존하므로 magic-bytes 검사로 보강하는 것이 이상적이다 (S14P31E103-220 또는 별도 보안 이슈).
 *
 * <p><b>반환 URL</b>: servlet context-path + {@link StorageProperties#publicUrlPrefix()} + 파일명.
 * 클라이언트가 {@code <img src>} 에 그대로 박아도 동작하도록 context-path 를 포함한다.
 *
 * <p><b>접근 통제</b>: 현재는 모든 업로드 파일이 정적 리소스 핸들러를 통해 누구나 URL 만 알면 접근 가능하다. UUID 기반 파일명이 추측을 어렵게는 하지만,
 * 비공개 작품 이미지에 대한 권한 체크는 제공하지 않는다. 이 정책은 S14P31E103-218/219 작업 시 재검토한다 (인증된 다운로드 컨트롤러로 전환할 수 있음).
 */
@Component
public class LocalImageStorage implements ImageStorage {

    /** 저장 허용 확장자. 정적 서빙 시 실행 가능한 콘텐츠(HTML/SVG 등) 차단을 위해 white-list 로 강제. */
    private static final Set<String> ALLOWED_EXTENSIONS =
            Set.of(".png", ".jpg", ".jpeg", ".webp", ".gif");

    private final StorageProperties properties;

    /** servlet context-path. {@code application.yaml} 의 {@code server.servlet.context-path} 값. */
    private final String contextPath;

    public LocalImageStorage(
            StorageProperties properties,
            @Value("${server.servlet.context-path:}") String contextPath) {
        this.properties = properties;
        this.contextPath = contextPath == null ? "" : contextPath;
    }

    @Override
    public StoredImage upload(MultipartFile file) {
        validateImage(file);

        String filename = UUID.randomUUID() + extractExtension(file.getOriginalFilename());
        Path target = Path.of(properties.uploadDir()).toAbsolutePath().resolve(filename);

        try {
            Files.createDirectories(target.getParent());
            file.transferTo(target);
        } catch (IOException e) {
            throw new BusinessException(GlobalErrorCode.INTERNAL_SERVER_ERROR);
        }

        return new StoredImage(contextPath + properties.publicUrlPrefix() + "/" + filename);
    }

    @Override
    public void delete(String url) {
        if (url == null || url.isBlank()) {
            return;
        }
        String filename = url.substring(url.lastIndexOf('/') + 1);
        if (filename.isBlank()) {
            return;
        }
        try {
            Files.deleteIfExists(
                    Path.of(properties.uploadDir()).toAbsolutePath().resolve(filename));
        } catch (IOException e) {
            throw new BusinessException(GlobalErrorCode.INTERNAL_SERVER_ERROR);
        }
    }

    private void validateImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(GlobalErrorCode.INVALID_INPUT);
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
            throw new BusinessException(GlobalErrorCode.INVALID_INPUT);
        }
    }

    /**
     * 원본 파일명에서 확장자를 추출하고 {@link #ALLOWED_EXTENSIONS} 와 대조한다. 누락/허용 외 확장자는 모두 거부 — 거짓 Content-Type
     * 헤더로 검증을 우회하더라도 저장 파일이 실행 가능한 형식이 되지 않도록 강제한다.
     */
    private String extractExtension(String originalFilename) {
        if (originalFilename == null) {
            throw new BusinessException(GlobalErrorCode.INVALID_INPUT);
        }
        int dot = originalFilename.lastIndexOf('.');
        if (dot < 0 || dot == originalFilename.length() - 1) {
            throw new BusinessException(GlobalErrorCode.INVALID_INPUT);
        }
        String ext = originalFilename.substring(dot).toLowerCase(Locale.ROOT);
        if (!ALLOWED_EXTENSIONS.contains(ext)) {
            throw new BusinessException(GlobalErrorCode.INVALID_INPUT);
        }
        return ext;
    }
}
