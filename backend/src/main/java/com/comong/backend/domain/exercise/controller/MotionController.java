package com.comong.backend.domain.exercise.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.comong.backend.domain.exercise.dto.MotionResponse;
import com.comong.backend.domain.exercise.entity.ExerciseType;
import com.comong.backend.domain.exercise.service.MotionService;
import com.comong.backend.global.common.response.ApiResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

@Tag(name = "Exercise Motion", description = "체조 동작 조회 API")
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
}
