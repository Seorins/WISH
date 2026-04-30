package com.comong.backend.global.storage;

import org.springframework.web.multipart.MultipartFile;

/**
 * 영상 저장소 추상화. 현재 {@link LocalVideoStorage} 가 유일 구현. S14P31E103-240 계열 작업으로 S3 구현체가 추가될 때 동일 인터페이스로
 * 갈아끼우도록 설계되었다 ({@link ImageStorage} 와 대칭).
 *
 * <p>구현체는 다음을 책임진다:
 *
 * <ul>
 *   <li>업로드 파일이 {@code video/*} MIME 와 알려진 영상 시그니처(MP4 / WebM) 를 충족하는지 검증
 *   <li>파일명 충돌 방지 (UUID 등)
 *   <li>외부 노출용 URL 생성 (DB {@code demo_video_url} 컬럼에 저장됨)
 *   <li>주어진 URL 로 저장된 파일 제거
 * </ul>
 */
public interface VideoStorage {

    /**
     * 영상을 저장하고 외부 노출용 URL 을 반환한다.
     *
     * @throws com.comong.backend.global.exception.BusinessException 빈 파일이거나 영상 검증 실패 시 {@code S-004
     *     INVALID_VIDEO}, 한도 초과 시 {@code S-003 PAYLOAD_TOO_LARGE}, IO 실패 시 {@code S-002
     *     STORAGE_FAILURE}
     */
    StoredVideo upload(MultipartFile file);

    /**
     * 저장된 영상을 제거한다. 파일이 존재하지 않으면 조용히 무시한다 (idempotent).
     *
     * @param url {@link #upload} 가 반환했던 URL
     */
    void delete(String url);
}
