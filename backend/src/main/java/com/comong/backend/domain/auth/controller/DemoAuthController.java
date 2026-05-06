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
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

@Tag(name = "Auth", description = "MVP 데모 인증 API")
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
@Profile({"local", "dev", "test"})
public class DemoAuthController {

    private final DemoAuthService demoAuthService;

    @Operation(
            summary = "데모 토큰 발급",
            description =
                    "MVP 데모에서 로그인 화면 없이 사용할 access 토큰을 발급한다."
                            + " local/dev/test 프로파일에서만 활성. prod 에서는 빈 자체가 등록되지 않아 404.")
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "토큰 발급 성공"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "404",
                description = "prod 프로파일에서는 비활성 (Spring Security 가 등록 안 된 경로로 처리)")
    })
    @PostMapping("/demo-token")
    public ResponseEntity<ApiResponse<TokenResponse>> issueDemoToken() {
        return ResponseEntity.ok(ApiResponse.success(demoAuthService.issueDemoToken()));
    }
}
