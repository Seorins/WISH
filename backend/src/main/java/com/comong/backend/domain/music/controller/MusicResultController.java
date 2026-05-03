package com.comong.backend.domain.music.controller;

import java.util.List;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.comong.backend.domain.music.dto.MusicBestResultResponse;
import com.comong.backend.domain.music.dto.MusicResultResponse;
import com.comong.backend.domain.music.dto.MusicResultSaveRequest;
import com.comong.backend.domain.music.service.MusicResultService;
import com.comong.backend.global.common.response.ApiResponse;
import com.comong.backend.global.security.JwtTokenProvider.AuthenticatedUser;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

@Tag(name = "Music Result", description = "음악 리듬게임 결과 API")
@RestController
@RequestMapping("/music/results")
@RequiredArgsConstructor
public class MusicResultController {

    private final MusicResultService musicResultService;

    @Operation(summary = "음악 리듬게임 결과 저장", description = "음악 리듬게임 한 판 플레이 결과를 저장합니다.")
    @PostMapping
    public ResponseEntity<ApiResponse<MusicResultResponse>> create(
            @AuthenticationPrincipal AuthenticatedUser currentUser,
            @Valid @RequestBody MusicResultSaveRequest request) {
        MusicResultResponse response = musicResultService.create(currentUser.userId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    @Operation(summary = "내 음악 리듬게임 곡별 최고 기록 조회", description = "현재 로그인 사용자의 곡별 최고 기록을 조회합니다.")
    @GetMapping("/me/best")
    public ResponseEntity<ApiResponse<List<MusicBestResultResponse>>> findMyBest(
            @AuthenticationPrincipal AuthenticatedUser currentUser) {
        return ResponseEntity.ok(
                ApiResponse.success(musicResultService.findMyBest(currentUser.userId())));
    }
}
