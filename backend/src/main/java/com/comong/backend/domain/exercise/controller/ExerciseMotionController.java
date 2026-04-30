package com.comong.backend.domain.exercise.controller;

import java.net.URI;
import java.util.List;

import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.comong.backend.domain.exercise.dto.ExerciseMotionCreateRequest;
import com.comong.backend.domain.exercise.dto.ExerciseMotionResponse;
import com.comong.backend.domain.exercise.dto.ExerciseMotionUpdateRequest;
import com.comong.backend.domain.exercise.entity.ExerciseType;
import com.comong.backend.domain.exercise.service.ExerciseMotionService;
import com.comong.backend.global.common.response.ApiResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

@Tag(name = "Exercise Motion", description = "체조 동작 조회 및 관리자 API")
@RestController
@RequestMapping("/exercise-motions")
@RequiredArgsConstructor
public class ExerciseMotionController {

    private final ExerciseMotionService exerciseMotionService;

    @Operation(summary = "체조 동작 목록 조회", description = "체조 타입별 동작을 루틴 순서 오름차순으로 조회한다.")
    @GetMapping
    public ResponseEntity<ApiResponse<List<ExerciseMotionResponse>>> list(
            @RequestParam ExerciseType exerciseType) {
        return ResponseEntity.ok(
                ApiResponse.success(exerciseMotionService.findAllByExerciseType(exerciseType)));
    }

    @Operation(summary = "체조 동작 상세 조회", description = "체조 동작 마스터 데이터를 단건 조회한다.")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ExerciseMotionResponse>> detail(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(exerciseMotionService.findOne(id)));
    }

    @Operation(summary = "체조 동작 등록", description = "ADMIN 권한으로 체조 동작 마스터 데이터를 등록한다.")
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ResponseEntity<ApiResponse<ExerciseMotionResponse>> create(
            @Valid @RequestBody ExerciseMotionCreateRequest request) {
        ExerciseMotionResponse response = exerciseMotionService.create(request);
        URI location = URI.create("/exercise-motions/" + response.id());
        return ResponseEntity.created(location).body(ApiResponse.success(response));
    }

    @Operation(summary = "체조 동작 수정", description = "ADMIN 권한으로 체조 동작 마스터 데이터를 수정한다.")
    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/{id}")
    public ResponseEntity<ApiResponse<ExerciseMotionResponse>> update(
            @PathVariable Long id, @Valid @RequestBody ExerciseMotionUpdateRequest request) {
        return ResponseEntity.ok(ApiResponse.success(exerciseMotionService.update(id, request)));
    }

    @Operation(summary = "체조 동작 삭제", description = "ADMIN 권한으로 아직 수행 기록에서 사용되지 않은 체조 동작을 삭제한다.")
    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        exerciseMotionService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
