package com.comong.backend.domain.dialogue.exception;

import org.springframework.http.HttpStatus;

import com.comong.backend.global.exception.ErrorCode;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/** Dialogue 도메인 에러 코드. 접두사 {@code DL-} 사용 — NPC 와의 턴 기반 대화 (등대지기 + 마을 주민 5인) 도메인. */
@Getter
@RequiredArgsConstructor
public enum DialogueErrorCode implements ErrorCode {
    SESSION_NOT_FOUND(HttpStatus.NOT_FOUND, "DL-001", "대화 세션을 찾을 수 없습니다."),
    SESSION_ACCESS_DENIED(HttpStatus.FORBIDDEN, "DL-002", "대화 세션에 접근할 권한이 없습니다.");

    private final HttpStatus status;
    private final String code;
    private final String message;
}
