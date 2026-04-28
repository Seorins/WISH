package com.comong.backend.global.storage;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.UUID;

import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import com.comong.backend.global.exception.BusinessException;
import com.comong.backend.global.exception.GlobalErrorCode;

import lombok.RequiredArgsConstructor;

/**
 * 로컬 디스크에 이미지를 저장하는 {@link ImageStorage} 구현체.
 *
 * <p>파일명 충돌 방지를 위해 UUID 기반 이름을 생성하며, 원본 확장자는 보존한다 (확장자 부재 시 {@code .png} 로 가정).
 *
 * <p><b>보안 주의</b>: 현재는 모든 업로드 파일이 정적 리소스 핸들러를 통해 누구나 URL 만 알면 접근 가능하다. UUID 기반 파일명이 추측을 어렵게는 하지만,
 * 비공개 작품 이미지에 대한 권한 체크는 제공하지 않는다. 이 정책은 S14P31E103-218/219 작업 시 재검토한다 (인증된 다운로드 컨트롤러로 전환할 수 있음).
 */
@Component
@RequiredArgsConstructor
public class LocalImageStorage implements ImageStorage {

    private final StorageProperties properties;

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

        return new StoredImage(properties.publicUrlPrefix() + "/" + filename);
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

    private String extractExtension(String originalFilename) {
        if (originalFilename == null) {
            return ".png";
        }
        int dot = originalFilename.lastIndexOf('.');
        if (dot < 0 || dot == originalFilename.length() - 1) {
            return ".png";
        }
        return originalFilename.substring(dot).toLowerCase(Locale.ROOT);
    }
}
