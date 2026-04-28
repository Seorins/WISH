package com.comong.backend.domain.artwork.dto;

import jakarta.validation.constraints.PositiveOrZero;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 작품 수정 요청. PATCH 시맨틱: {@code null} 인 필드는 변경 없음.
 *
 * <p>{@code additionalPlayDurationSeconds} 는 절대 시간이 아닌 "이번 세션 추가" 누적분이라, 서버에서 {@code
 * playDurationSeconds += ?} 로 더한다. 음수 방어는 DTO + 엔티티 양쪽에서.
 */
public record ArtworkUpdateRequest(
        @Schema(description = "공개 여부 변경 (변경 없으면 생략)", example = "true") Boolean isPublic,
        @Schema(description = "이번 세션 추가 플레이 시간(초). 누적됨 (변경 없으면 생략)", example = "30") @PositiveOrZero
                Integer additionalPlayDurationSeconds) {}
