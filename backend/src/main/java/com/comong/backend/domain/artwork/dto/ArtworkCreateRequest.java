package com.comong.backend.domain.artwork.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 작품 저장 요청 메타데이터. multipart 의 {@code request} 파트로 JSON 전송, 이미지 파일은 별도 {@code image} 파트로.
 *
 * <p>{@code playDurationSeconds} 음수 방어: DTO 단계에서 {@code @PositiveOrZero} 로 1차 차단하고, {@code Artwork}
 * 빌더에서 invariant 로 한 번 더 확인 (216 MR AI 리뷰 #2 후속).
 */
public record ArtworkCreateRequest(
        @Schema(description = "FE 정적 자산의 도안 식별자", example = "cat-01") @NotBlank @Size(max = 50)
                String sketchCode,
        @Schema(description = "사용자 지정 작품 제목 (선택)", example = "내 첫 고양이") @Size(max = 50)
                String title,
        @Schema(description = "플레이 시간(초)", example = "87") @NotNull @PositiveOrZero
                Integer playDurationSeconds,
        @Schema(description = "공개 갤러리 노출 여부", example = "false") @NotNull Boolean isPublic) {}
