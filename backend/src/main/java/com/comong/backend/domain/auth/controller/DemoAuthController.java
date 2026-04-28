package com.comong.backend.domain.auth.controller;

import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.comong.backend.domain.auth.dto.TokenResponse;
import com.comong.backend.domain.auth.service.DemoAuthService;
import com.comong.backend.global.common.response.ApiResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

@Tag(name = "Auth", description = "MVP 데모 인증 API")
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
@Profile({"local", "dev", "test"})
public class DemoAuthController {

    private final DemoAuthService demoAuthService;

    @Operation(summary = "데모 토큰 발급", description = "MVP 데모에서 로그인 화면 없이 사용할 access 토큰을 발급한다.")
    @PostMapping("/demo-token")
    public ResponseEntity<ApiResponse<TokenResponse>> issueDemoToken() {
        return ResponseEntity.ok(ApiResponse.success(demoAuthService.issueDemoToken()));
    }
}
