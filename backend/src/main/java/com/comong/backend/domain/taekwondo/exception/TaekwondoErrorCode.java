package com.comong.backend.domain.taekwondo.exception;

import org.springframework.http.HttpStatus;

import com.comong.backend.global.exception.ErrorCode;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum TaekwondoErrorCode implements ErrorCode {
    TAEKWONDO_MOTION_NOT_FOUND(HttpStatus.NOT_FOUND, "TK-001", "태권도 동작을 찾을 수 없습니다."),
    TAEKWONDO_MOTION_ROUTINE_ORDER_DUPLICATED(
            HttpStatus.CONFLICT, "TK-002", "같은 품새에 이미 등록된 동작 순서입니다."),
    TAEKWONDO_MOTION_IN_USE(
            HttpStatus.CONFLICT, "TK-003", "수행 기록에서 사용 중인 태권도 동작은 삭제할 수 없습니다."),
    TAEKWONDO_SESSION_MOTION_POOMSAE_MISMATCH(
            HttpStatus.BAD_REQUEST, "TK-004", "세션 품새와 동작 품새가 일치하지 않습니다."),
    TAEKWONDO_SESSION_NOT_FOUND(HttpStatus.NOT_FOUND, "TK-005", "태권도 세션을 찾을 수 없습니다.");

    private final HttpStatus status;
    private final String code;
    private final String message;
}
