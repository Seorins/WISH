package com.comong.backend.domain.gomoku.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import com.comong.backend.domain.gomoku.entity.GomokuRuleSet;

public record GomokuRoomCreateRequest(
        @NotNull GomokuRuleSet ruleSet, @Min(60) @Max(1800) int timerSeconds) {}
