package com.comong.backend.domain.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import com.comong.backend.domain.user.entity.User;

import io.swagger.v3.oas.annotations.media.Schema;

public record UserSignupRequest(
        @Schema(description = "이메일", example = "user@comong.com") @NotBlank @Email @Size(max = 100)
                String email,
        @Schema(description = "닉네임 (2~30자)", example = "코몽이") @NotBlank @Size(min = 2, max = 30)
                String nickname,
        @Schema(description = "비밀번호 (영문/숫자/특수문자 포함 8~64자)", example = "P@ssw0rd!")
                @NotBlank
                @Size(min = 8, max = 64)
                @Pattern(
                        regexp = "^(?=.*[A-Za-z])(?=.*\\d)(?=.*[^A-Za-z0-9]).+$",
                        message = "비밀번호는 영문, 숫자, 특수문자를 각각 1개 이상 포함해야 합니다.")
                String password) {

    /** 비밀번호는 암호화된 값을 넘기도록 강제. 평문을 받으면 엔티티 생성 불가. */
    public User toEntity(String encodedPassword) {
        return User.builder().email(email).nickname(nickname).password(encodedPassword).build();
    }
}
