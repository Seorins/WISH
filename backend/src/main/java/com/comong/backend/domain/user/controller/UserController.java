package com.comong.backend.domain.user.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.comong.backend.domain.user.dto.UserResponse;
import com.comong.backend.domain.user.service.UserService;
import com.comong.backend.global.common.response.ApiResponse;
import com.comong.backend.global.security.JwtTokenProvider.AuthenticatedUser;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

@Tag(name = "User", description = "사용자 API")
@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    /**
     * 본인 정보 조회. 인증된 사용자가 자기 자신의 프로필을 읽는 유일한 엔드포인트.
     *
     * <p>ID 기반 조회(`/users/{id}`)는 제거됐다. 순차 PK 를 enumerate 하면 타인의 이메일까지 조회 가능해 PII 노출 위험이 있었기 때문. 공개
     * 프로필이 필요해지면 별도 DTO(email 제외) + 별도 엔드포인트로 분리한다.
     */
    @Operation(summary = "내 정보 조회", description = "현재 인증된 사용자의 정보를 조회한다.")
    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserResponse>> getMe(
            @AuthenticationPrincipal AuthenticatedUser currentUser) {
        return ResponseEntity.ok(ApiResponse.success(userService.getUser(currentUser.userId())));
    }
}
