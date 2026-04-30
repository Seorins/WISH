package com.comong.backend.domain.exercise.controller;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.comong.backend.domain.exercise.dto.ExerciseSessionResponse;
import com.comong.backend.domain.exercise.dto.ExerciseSessionSaveRequest;
import com.comong.backend.domain.exercise.service.ExerciseSessionService;
import com.comong.backend.global.common.response.ApiResponse;
import com.comong.backend.global.security.JwtTokenProvider.AuthenticatedUser;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

@Tag(name = "Exercise Session", description = "체조 세션 결과 API")
@RestController
@RequestMapping("/exercise-sessions")
@RequiredArgsConstructor
public class ExerciseSessionController {

    private final ExerciseSessionService exerciseSessionService;

    @Operation(summary = "체조 세션 기록 저장", description = "체조 세션과 동작별 수행 결과를 저장합니다.")
    @PostMapping
    public ResponseEntity<ApiResponse<ExerciseSessionResponse>> create(
            @AuthenticationPrincipal AuthenticatedUser currentUser,
            @Valid @RequestBody ExerciseSessionSaveRequest request) {
        ExerciseSessionResponse response =
                exerciseSessionService.create(currentUser.userId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }
}
