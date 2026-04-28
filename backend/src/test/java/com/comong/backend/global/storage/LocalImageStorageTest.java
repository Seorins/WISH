package com.comong.backend.global.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import com.comong.backend.global.exception.BusinessException;

class LocalImageStorageTest {

    private static final byte[] PNG_BYTES = {
        (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0
    };

    private static final byte[] JPEG_BYTES = {
        (byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 0, 0, 0
    };

    @TempDir Path uploadDir;

    @Test
    void storesJpegWithCanonicalJpgExtension() {
        LocalImageStorage storage = storage();
        MultipartFile file =
                new MockMultipartFile("file", "painting.jpeg", "image/jpeg", JPEG_BYTES);

        StoredImage storedImage = storage.upload(file);

        assertThat(storedImage.url()).startsWith("/api/v1/uploads/");
        assertThat(storedImage.url()).endsWith(".jpg");
        String filename = storedImage.url().substring(storedImage.url().lastIndexOf('/') + 1);
        assertThat(Files.exists(uploadDir.resolve(filename))).isTrue();
    }

    @Test
    void rejectsWhenMagicBytesDoNotMatchExtension() {
        LocalImageStorage storage = storage();
        MultipartFile file = new MockMultipartFile("file", "painting.jpg", "image/png", PNG_BYTES);

        assertThatThrownBy(() -> storage.upload(file)).isInstanceOf(BusinessException.class);
    }

    @Test
    void rejectsHtmlMasqueradingAsPng() {
        LocalImageStorage storage = storage();
        MultipartFile file =
                new MockMultipartFile(
                        "file",
                        "painting.png",
                        "image/png",
                        "<html></html>".getBytes(StandardCharsets.UTF_8));

        assertThatThrownBy(() -> storage.upload(file)).isInstanceOf(BusinessException.class);
    }

    private LocalImageStorage storage() {
        return new LocalImageStorage(
                new StorageProperties(uploadDir.toString(), "/uploads"), "/api/v1");
    }
}
