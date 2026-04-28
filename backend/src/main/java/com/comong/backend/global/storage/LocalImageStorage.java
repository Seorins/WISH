package com.comong.backend.global.storage;

import java.io.IOException;
import java.io.InputStream;
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
 * <p><b>업로드 검증 — 3중 방어</b>:
 *
 * <ol>
 *   <li>{@code Content-Type} 이 {@code image/*} 인지 (1차, 클라이언트 헤더라 신뢰도 낮음)
 *   <li>원본 파일명 확장자가 {@link #ALLOWED_EXTENSIONS} 에 포함되는지 (2차, 정적 서빙 시 실행 가능 콘텐츠 차단)
 *   <li>실제 binary 의 magic bytes 가 허용 포맷의 시그니처와 일치하는지 (3차, 헤더+확장자 거짓말을 모두 우회)
 * </ol>
 *
 * <p><b>접근 통제</b>: 현재는 모든 업로드 파일이 정적 리소스 핸들러를 통해 누구나 URL 만 알면 접근 가능하다. UUID 기반 파일명이 추측을 어렵게는 하지만,
 * 비공개 작품 이미지에 대한 권한 체크는 제공하지 않는다. 이 정책은 S14P31E103-218/219 작업 시 재검토한다.
 */
@Component
public class LocalImageStorage implements ImageStorage {

    /** 저장 허용 확장자 (white-list). */
    private static final Set<String> ALLOWED_EXTENSIONS =
            Set.of(".png", ".jpg", ".jpeg", ".webp", ".gif");

    /** magic-bytes 검사 시 읽을 헤더 크기 — RIFF/WEBP 가 12 byte 라 가장 큼. */
    private static final int MAGIC_HEAD_SIZE = 12;

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
        verifyMagicBytes(file);
    }

    /**
     * 파일의 첫 {@value #MAGIC_HEAD_SIZE} 바이트를 읽어 알려진 이미지 시그니처와 대조한다. PNG / JPEG / GIF87a / GIF89a /
     * WEBP(RIFF) 만 통과시킨다. {@link MultipartFile#getInputStream()} 은 새 스트림을 반환하므로, 검증 후 {@link
     * MultipartFile#transferTo} 가 별도로 동작한다.
     */
    private void verifyMagicBytes(MultipartFile file) {
        byte[] head;
        try (InputStream in = file.getInputStream()) {
            head = in.readNBytes(MAGIC_HEAD_SIZE);
        } catch (IOException e) {
            throw new BusinessException(GlobalErrorCode.INTERNAL_SERVER_ERROR);
        }
        if (isPng(head) || isJpeg(head) || isGif(head) || isWebp(head)) {
            return;
        }
        throw new BusinessException(GlobalErrorCode.INVALID_INPUT);
    }

    /** PNG: 89 50 4E 47 0D 0A 1A 0A */
    private static boolean isPng(byte[] h) {
        return h.length >= 8
                && (h[0] & 0xFF) == 0x89
                && h[1] == 0x50
                && h[2] == 0x4E
                && h[3] == 0x47
                && h[4] == 0x0D
                && h[5] == 0x0A
                && h[6] == 0x1A
                && h[7] == 0x0A;
    }

    /** JPEG: FF D8 FF (네번째 바이트는 SOI 마커별로 다양하므로 검사하지 않음) */
    private static boolean isJpeg(byte[] h) {
        return h.length >= 3
                && (h[0] & 0xFF) == 0xFF
                && (h[1] & 0xFF) == 0xD8
                && (h[2] & 0xFF) == 0xFF;
    }

    /** GIF87a / GIF89a: "GIF87a" 또는 "GIF89a" */
    private static boolean isGif(byte[] h) {
        if (h.length < 6) {
            return false;
        }
        return h[0] == 'G'
                && h[1] == 'I'
                && h[2] == 'F'
                && h[3] == '8'
                && (h[4] == '7' || h[4] == '9')
                && h[5] == 'a';
    }

    /** WEBP: "RIFF" + (4 byte 크기) + "WEBP" */
    private static boolean isWebp(byte[] h) {
        return h.length >= 12
                && h[0] == 'R'
                && h[1] == 'I'
                && h[2] == 'F'
                && h[3] == 'F'
                && h[8] == 'W'
                && h[9] == 'E'
                && h[10] == 'B'
                && h[11] == 'P';
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
