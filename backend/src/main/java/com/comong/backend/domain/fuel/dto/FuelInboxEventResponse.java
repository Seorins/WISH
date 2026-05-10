package com.comong.backend.domain.fuel.dto;

import java.time.LocalDateTime;

import com.comong.backend.domain.fuel.entity.FuelEvent;

import io.swagger.v3.oas.annotations.media.Schema;

public record FuelInboxEventResponse(
        @Schema(description = "Fuel event id") Long id,
        @Schema(description = "Fuel amount") int amount,
        @Schema(description = "Guardian message") String message,
        @Schema(description = "Sent time") LocalDateTime createdAt) {

    public static FuelInboxEventResponse from(FuelEvent event) {
        return new FuelInboxEventResponse(
                event.getId(), event.getAmount(), event.getMessage(), event.getCreatedAt());
    }
}
