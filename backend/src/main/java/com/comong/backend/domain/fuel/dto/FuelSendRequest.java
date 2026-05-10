package com.comong.backend.domain.fuel.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import io.swagger.v3.oas.annotations.media.Schema;

public record FuelSendRequest(
        @Schema(description = "Fuel amount", example = "20") @NotNull @Min(1) @Max(100)
                Integer amount,
        @Schema(description = "Guardian message", example = "You are doing great.")
                @NotBlank
                @Size(max = 100)
                String message) {

    public String normalizedMessage() {
        return message.trim();
    }
}
