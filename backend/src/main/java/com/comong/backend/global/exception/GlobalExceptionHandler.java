package com.comong.backend.global.exception;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import com.comong.backend.global.common.response.ApiResponse;
import com.comong.backend.global.storage.StorageErrorCode;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusinessException(BusinessException e) {
        ErrorCode errorCode = e.getErrorCode();
        log.warn("BusinessException: {} - {}", errorCode.getCode(), errorCode.getMessage());
        return ResponseEntity.status(errorCode.getStatus()).body(ApiResponse.error(errorCode));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidationException(
            MethodArgumentNotValidException e) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        e.getBindingResult()
                .getFieldErrors()
                .forEach(
                        fe ->
                                fieldErrors.merge(
                                        fe.getField(),
                                        fe.getDefaultMessage(),
                                        (existing, next) -> existing + "; " + next));
        log.warn("ValidationException: {}", fieldErrors);
        return ResponseEntity.status(GlobalErrorCode.INVALID_INPUT.getStatus())
                .body(ApiResponse.error(GlobalErrorCode.INVALID_INPUT, fieldErrors));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiResponse<Void>> handleMaxUploadSizeExceeded(
            MaxUploadSizeExceededException e) {
        log.warn("multipart 한도 초과: {}", e.getMessage());
        return ResponseEntity.status(StorageErrorCode.PAYLOAD_TOO_LARGE.getStatus())
                .body(ApiResponse.error(StorageErrorCode.PAYLOAD_TOO_LARGE));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleUnexpectedException(Exception e) {
        log.error("Unhandled exception", e);
        return ResponseEntity.status(GlobalErrorCode.INTERNAL_SERVER_ERROR.getStatus())
                .body(ApiResponse.error(GlobalErrorCode.INTERNAL_SERVER_ERROR));
    }
}
