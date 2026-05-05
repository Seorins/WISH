package com.comong.backend.domain.taekwondo.controller;

import java.util.List;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.comong.backend.domain.taekwondo.dto.TaekwondoSessionResponse;
import com.comong.backend.domain.taekwondo.dto.TaekwondoSessionSaveRequest;
import com.comong.backend.domain.taekwondo.dto.TaekwondoSessionSummaryResponse;
import com.comong.backend.domain.taekwondo.service.TaekwondoSessionService;
import com.comong.backend.global.common.response.ApiResponse;
import com.comong.backend.global.security.JwtTokenProvider.AuthenticatedUser;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

@Tag(name = "Taekwondo Session", description = "태권도 세션 결과 API")
@RestController
@RequestMapping("/taekwondo-sessions")
@RequiredArgsConstructor
public class TaekwondoSessionController {

    private final TaekwondoSessionService taekwondoSessionService;

    @Operation(summary = "태권도 세션 기록 목록 조회", description = "환자별 태권도 세션 기록 요약 목록을 조회합니다.")
    @GetMapping
    public ResponseEntity<ApiResponse<List<TaekwondoSessionSummaryResponse>>> list(
            @AuthenticationPrincipal AuthenticatedUser currentUser,
            @RequestParam Long patientProfileId) {
        return ResponseEntity.ok(
                ApiResponse.success(
                        taekwondoSessionService.findAll(currentUser.userId(), patientProfileId)));
    }

    @Operation(summary = "태권도 세션 기록 상세 조회", description = "태권도 세션과 동작별 수행 결과를 조회합니다.")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<TaekwondoSessionResponse>> detail(
            @AuthenticationPrincipal AuthenticatedUser currentUser, @PathVariable Long id) {
        return ResponseEntity.ok(
                ApiResponse.success(taekwondoSessionService.findOne(currentUser.userId(), id)));
    }

    @Operation(summary = "태권도 세션 기록 저장", description = "태권도 세션과 동작별 수행 결과를 저장합니다.")
    @PostMapping
    public ResponseEntity<ApiResponse<TaekwondoSessionResponse>> create(
            @AuthenticationPrincipal AuthenticatedUser currentUser,
            @Valid @RequestBody TaekwondoSessionSaveRequest request) {
        TaekwondoSessionResponse response =
                taekwondoSessionService.create(currentUser.userId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }
}
