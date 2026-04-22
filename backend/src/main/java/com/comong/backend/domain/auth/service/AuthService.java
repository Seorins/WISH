package com.comong.backend.domain.auth.service;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.comong.backend.domain.auth.dto.LoginRequest;
import com.comong.backend.domain.auth.dto.TokenResponse;
import com.comong.backend.domain.auth.exception.AuthErrorCode;
import com.comong.backend.domain.user.entity.User;
import com.comong.backend.domain.user.service.UserService;
import com.comong.backend.global.exception.BusinessException;
import com.comong.backend.global.security.JwtTokenProvider;

import lombok.RequiredArgsConstructor;

/**
 * 인증 유스케이스. User 도메인과는 service 레이어로 의존 (컨벤션 준수).
 *
 * <p>로그인 실패 시 "이메일 없음" 과 "비밀번호 불일치" 를 구분하지 않고 동일한 {@link AuthErrorCode#INVALID_CREDENTIALS} 로 응답 —
 * 계정 enumeration 방지.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuthService {

    private final UserService userService;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    public TokenResponse login(LoginRequest request) {
        User user =
                userService
                        .findEntityByEmail(request.email())
                        .orElseThrow(
                                () -> new BusinessException(AuthErrorCode.INVALID_CREDENTIALS));
        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new BusinessException(AuthErrorCode.INVALID_CREDENTIALS);
        }
        String token = jwtTokenProvider.createAccessToken(user.getId(), user.getEmail());
        return TokenResponse.of(token, jwtTokenProvider.getAccessTokenTtlSeconds());
    }
}
