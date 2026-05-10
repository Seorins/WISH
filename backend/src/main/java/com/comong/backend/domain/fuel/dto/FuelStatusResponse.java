package com.comong.backend.domain.fuel.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

public record FuelStatusResponse(
        @Schema(description = "Displayed gauge percentage") int percentage,
        @Schema(description = "Lifetime fuel amount sum") long totalAmount,
        @Schema(description = "Whether the fuel journey reached 100 percent") boolean completed,
        @Schema(description = "Fuel event history, newest first") List<FuelEventResponse> events) {

    public static FuelStatusResponse of(long totalAmount, List<FuelEventResponse> events) {
        int percentage = (int) Math.min(100, totalAmount);
        return new FuelStatusResponse(percentage, totalAmount, totalAmount >= 100, events);
    }
}
