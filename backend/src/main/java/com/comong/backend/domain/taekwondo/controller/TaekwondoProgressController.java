package com.comong.backend.domain.taekwondo.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.comong.backend.domain.taekwondo.dto.TaekwondoProgressResponse;
import com.comong.backend.domain.taekwondo.service.TaekwondoProgressService;
import com.comong.backend.global.common.response.ApiResponse;
import com.comong.backend.global.security.JwtTokenProvider.AuthenticatedUser;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

@Tag(name = "Taekwondo Progress", description = "태권도 진행 상태 API")
@RestController
@RequestMapping("/taekwondo-progress")
@RequiredArgsConstructor
public class TaekwondoProgressController {

    private final TaekwondoProgressService taekwondoProgressService;

    @Operation(
            summary = "태권도 진행 상태 조회",
            description = "현재 띠, 누적 처치수, 다음 띠 임계값까지 남은 처치수, 세션 수, 평균 정확도를 조회합니다.")
    @GetMapping
    public ResponseEntity<ApiResponse<TaekwondoProgressResponse>> findOne(
            @AuthenticationPrincipal AuthenticatedUser currentUser,
            @RequestParam Long patientProfileId) {
        return ResponseEntity.ok(
                ApiResponse.success(
                        taekwondoProgressService.findOne(currentUser.userId(), patientProfileId)));
    }
}
