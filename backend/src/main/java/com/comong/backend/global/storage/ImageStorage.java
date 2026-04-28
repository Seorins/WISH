package com.comong.backend.global.storage;

import org.springframework.web.multipart.MultipartFile;

/**
 * 이미지 저장소 추상화. 로컬 디스크 / S3 등 다양한 백엔드를 갈아끼울 수 있도록 인터페이스만 노출한다.
 *
 * <p>구현체는 다음을 책임진다:
 *
 * <ul>
 *   <li>업로드 파일이 image/* MIME 타입인지 검증
 *   <li>파일명 충돌 방지 (UUID 등)
 *   <li>외부 노출용 URL 생성 (DB {@code image_url} 컬럼에 저장됨)
 *   <li>주어진 URL 로 저장된 파일 제거
 * </ul>
 */
public interface ImageStorage {

    /**
     * 이미지를 저장하고 외부 노출용 URL 을 반환한다.
     *
     * @throws com.comong.backend.global.exception.BusinessException 빈 파일이거나 image/* MIME 가 아니면
     *     {@code G-001 INVALID_INPUT}, IO 실패 시 {@code G-999 INTERNAL_SERVER_ERROR}
     */
    StoredImage upload(MultipartFile file);

    /**
     * 저장된 이미지를 제거한다. 파일이 존재하지 않으면 조용히 무시한다.
     *
     * @param url {@link #upload} 가 반환했던 URL
     */
    void delete(String url);
}
