package com.comong.backend.domain.artwork.dto;

import java.time.LocalDateTime;

import com.comong.backend.domain.artwork.entity.Artwork;

/**
 * 작품 단건 상세 응답. POST/PATCH 결과 + GET /artworks/{id} (본인용) + GET /artworks/me 항목.
 *
 * <p>공개 갤러리 (`/artworks/public`) 응답에는 작성자(닉네임) 가 추가된 {@link PublicArtworkResponse} 를 사용.
 */
public record ArtworkResponse(
        Long id,
        Integer sketchCode,
        String imageUrl,
        int playDurationSeconds,
        boolean isPublic,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {

    public static ArtworkResponse from(Artwork artwork) {
        return new ArtworkResponse(
                artwork.getId(),
                artwork.getSketchCode(),
                artwork.getImageUrl(),
                artwork.getPlayDurationSeconds(),
                artwork.isPublic(),
                artwork.getCreatedAt(),
                artwork.getUpdatedAt());
    }
}
