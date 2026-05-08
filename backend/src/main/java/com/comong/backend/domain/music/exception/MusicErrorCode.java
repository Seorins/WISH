package com.comong.backend.domain.music.exception;

import org.springframework.http.HttpStatus;

import com.comong.backend.global.exception.ErrorCode;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum MusicErrorCode implements ErrorCode {
    MUSIC_CHART_NOT_FOUND(HttpStatus.NOT_FOUND, "MU-001", "음악 차트를 찾을 수 없습니다."),
    MUSIC_RESULT_NOTE_COUNT_MISMATCH(
            HttpStatus.BAD_REQUEST, "MU-002", "판정 개수 합계가 전체 노트 수와 일치하지 않습니다."),
    MUSIC_CHART_TOTAL_NOTES_MISMATCH(
            HttpStatus.BAD_REQUEST, "MU-003", "요청 전체 노트 수가 차트 전체 노트 수와 일치하지 않습니다."),
    MUSIC_RESULT_NOT_FOUND(HttpStatus.NOT_FOUND, "MU-004", "음악 결과를 찾을 수 없습니다.");

    private final HttpStatus status;
    private final String code;
    private final String message;
}
