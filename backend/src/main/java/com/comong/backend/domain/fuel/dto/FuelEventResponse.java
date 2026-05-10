package com.comong.backend.domain.fuel.dto;

import java.time.LocalDateTime;

import com.comong.backend.domain.fuel.entity.FuelEvent;

import io.swagger.v3.oas.annotations.media.Schema;

public record FuelEventResponse(
        @Schema(description = "Fuel event id") Long id,
        @Schema(description = "Fuel amount") int amount,
        @Schema(description = "Guardian message") String message,
        @Schema(description = "Sent time") LocalDateTime createdAt,
        @Schema(description = "Consumed time") LocalDateTime consumedAt) {

    public static FuelEventResponse from(FuelEvent event) {
        return new FuelEventResponse(
                event.getId(),
                event.getAmount(),
                event.getMessage(),
                event.getCreatedAt(),
                event.getConsumedAt());
    }
}
