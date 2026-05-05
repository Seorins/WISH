package com.comong.backend.domain.taekwondo.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.comong.backend.domain.taekwondo.dto.TaekwondoBeltHistoryResponse;
import com.comong.backend.domain.taekwondo.service.TaekwondoProgressService;
import com.comong.backend.global.common.response.ApiResponse;
import com.comong.backend.global.security.JwtTokenProvider.AuthenticatedUser;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

@Tag(name = "Taekwondo Belt History", description = "태권도 띠 승급 이력 API")
@RestController
@RequestMapping("/taekwondo-belt-history")
@RequiredArgsConstructor
public class TaekwondoBeltHistoryController {

    private final TaekwondoProgressService taekwondoProgressService;

    @Operation(
            summary = "태권도 띠 승급 이력 조회",
            description = "환자별 띠 승급 이벤트를 최신 순으로 조회합니다. 첫 진입은 fromBelt = null 로 표시됩니다.")
    @GetMapping
    public ResponseEntity<ApiResponse<List<TaekwondoBeltHistoryResponse>>> findHistory(
            @AuthenticationPrincipal AuthenticatedUser currentUser,
            @RequestParam Long patientProfileId) {
        return ResponseEntity.ok(
                ApiResponse.success(
                        taekwondoProgressService.findHistory(
                                currentUser.userId(), patientProfileId)));
    }
}
