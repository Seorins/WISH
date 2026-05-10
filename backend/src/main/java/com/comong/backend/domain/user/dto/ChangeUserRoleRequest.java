package com.comong.backend.domain.user.dto;

import com.comong.backend.domain.user.entity.UserRole;

import jakarta.validation.constraints.NotNull;

public record ChangeUserRoleRequest(@NotNull UserRole role) {}
