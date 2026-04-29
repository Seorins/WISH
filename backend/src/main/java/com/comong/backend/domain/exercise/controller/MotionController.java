package com.comong.backend.domain.exercise.controller;

import java.net.URI;
import java.util.List;

import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.comong.backend.domain.exercise.dto.MotionCreateRequest;
import com.comong.backend.domain.exercise.dto.MotionResponse;
import com.comong.backend.domain.exercise.entity.ExerciseType;
import com.comong.backend.domain.exercise.service.MotionService;
import com.comong.backend.global.common.response.ApiResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

@Tag(name = "Exercise Motion", description = "체조 동작 관리 API")
@RestController
@RequestMapping("/exercise-motions")
@RequiredArgsConstructor
public class MotionController {

    private final MotionService motionService;

    @Operation(summary = "체조 동작 목록 조회", description = "체조 타입별 동작을 루틴 순서 오름차순으로 조회한다.")
    @GetMapping
    public ResponseEntity<ApiResponse<List<MotionResponse>>> list(
            @RequestParam ExerciseType exerciseType) {
        return ResponseEntity.ok(
                ApiResponse.success(motionService.findAllByExerciseType(exerciseType)));
    }

    @Operation(summary = "체조 동작 등록", description = "체조 타입별 동작 마스터 데이터를 등록한다.")
    @PostMapping
    public ResponseEntity<ApiResponse<MotionResponse>> create(
            @Valid @RequestBody MotionCreateRequest request) {
        MotionResponse response = motionService.create(request);
        URI location = URI.create("/exercise-motions/" + response.id());
        return ResponseEntity.created(location).body(ApiResponse.success(response));
    }

    @Operation(summary = "체조 동작 삭제", description = "아직 수행 기록에서 사용되지 않은 체조 동작을 삭제한다.")
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        motionService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
