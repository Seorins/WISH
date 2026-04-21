package com.comong.backend.domain.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import com.comong.backend.domain.user.entity.User;

public record UserSignupRequest(
        @NotBlank @Email @Size(max = 100) String email,
        @NotBlank @Size(min = 2, max = 30) String nickname) {
    public User toEntity() {
        return User.builder().email(email).nickname(nickname).build();
    }
}
