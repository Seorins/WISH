package com.comong.backend.domain.gomoku.exception;

import org.springframework.http.HttpStatus;

import com.comong.backend.global.exception.ErrorCode;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum GomokuErrorCode implements ErrorCode {
    GOMOKU_ROOM_NOT_FOUND(HttpStatus.NOT_FOUND, "GM-001", "오목 방을 찾을 수 없습니다."),
    GOMOKU_INVALID_ROOM_STATE(HttpStatus.BAD_REQUEST, "GM-002", "현재 오목 방 상태에서 수행할 수 없습니다."),
    GOMOKU_NOT_PARTICIPANT(HttpStatus.FORBIDDEN, "GM-003", "오목 방 참가자가 아닙니다."),
    GOMOKU_NOT_YOUR_TURN(HttpStatus.BAD_REQUEST, "GM-004", "현재 차례가 아닙니다."),
    GOMOKU_INVALID_MOVE(HttpStatus.BAD_REQUEST, "GM-005", "둘 수 없는 위치입니다."),
    GOMOKU_ROOM_FULL(HttpStatus.BAD_REQUEST, "GM-006", "이미 가득 찬 오목 방입니다."),
    GOMOKU_SELF_PLAY_NOT_ALLOWED(HttpStatus.BAD_REQUEST, "GM-007", "자신의 방에는 입장할 수 없습니다.");

    private final HttpStatus status;
    private final String code;
    private final String message;
}
