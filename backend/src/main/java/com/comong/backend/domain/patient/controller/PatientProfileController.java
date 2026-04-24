package com.comong.backend.domain.patient.controller;

import java.net.URI;
import java.util.List;

import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.comong.backend.domain.patient.dto.PatientProfileCreateRequest;
import com.comong.backend.domain.patient.dto.PatientProfileResponse;
import com.comong.backend.domain.patient.service.PatientProfileService;
import com.comong.backend.global.common.response.ApiResponse;
import com.comong.backend.global.security.JwtTokenProvider.AuthenticatedUser;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

@Tag(name = "PatientProfile", description = "환자 프로필 API")
@RestController
@RequestMapping("/patient-profiles")
@RequiredArgsConstructor
public class PatientProfileController {

    private final PatientProfileService patientProfileService;

    @Operation(summary = "환자 프로필 등록", description = "현재 로그인한 보호자 계정 하위로 환자 프로필을 생성한다.")
    @PostMapping
    public ResponseEntity<ApiResponse<PatientProfileResponse>> create(
            @AuthenticationPrincipal AuthenticatedUser currentUser,
            @Valid @RequestBody PatientProfileCreateRequest request) {
        PatientProfileResponse response =
                patientProfileService.create(currentUser.userId(), request);
        URI location = URI.create("/patient-profiles/" + response.id());
        return ResponseEntity.created(location).body(ApiResponse.success(response));
    }

    @Operation(summary = "환자 프로필 목록 조회", description = "현재 로그인한 보호자 계정이 소유한 환자 프로필 목록을 반환한다.")
    @GetMapping
    public ResponseEntity<ApiResponse<List<PatientProfileResponse>>> list(
            @AuthenticationPrincipal AuthenticatedUser currentUser) {
        return ResponseEntity.ok(
                ApiResponse.success(patientProfileService.findMine(currentUser.userId())));
    }

    @Operation(summary = "환자 프로필 단건 조회", description = "ID 로 환자 프로필을 조회한다. 본인 소유가 아니면 404 로 응답한다.")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<PatientProfileResponse>> detail(
            @AuthenticationPrincipal AuthenticatedUser currentUser, @PathVariable Long id) {
        return ResponseEntity.ok(
                ApiResponse.success(patientProfileService.findOne(currentUser.userId(), id)));
    }
}
