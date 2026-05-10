package com.comong.backend.domain.fuel.dto;

import io.swagger.v3.oas.annotations.media.Schema;

public record FuelConsumeResponse(@Schema(description = "Newly consumed event count") int count) {}
