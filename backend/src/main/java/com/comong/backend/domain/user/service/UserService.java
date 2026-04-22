package com.comong.backend.domain.user.service;

import java.util.Optional;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.comong.backend.domain.user.dto.UserResponse;
import com.comong.backend.domain.user.dto.UserSignupRequest;
import com.comong.backend.domain.user.entity.User;
import com.comong.backend.domain.user.exception.UserErrorCode;
import com.comong.backend.domain.user.repository.UserRepository;
import com.comong.backend.global.exception.BusinessException;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public UserResponse signup(UserSignupRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new BusinessException(UserErrorCode.EMAIL_DUPLICATED);
        }
        if (userRepository.existsByNickname(request.nickname())) {
            throw new BusinessException(UserErrorCode.NICKNAME_DUPLICATED);
        }
        String encodedPassword = passwordEncoder.encode(request.password());
        User saved = userRepository.save(request.toEntity(encodedPassword));
        return UserResponse.from(saved);
    }

    public UserResponse getUser(Long id) {
        User user =
                userRepository
                        .findById(id)
                        .orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));
        return UserResponse.from(user);
    }

    /**
     * 이메일로 User 엔티티 조회 (존재하지 않으면 빈 Optional). 로그인 등 "존재 여부 자체가 민감한" 흐름에서 호출 측이 자체 에러코드로 변환하기 위함. 일반
     * 조회는 {@link #getUser(Long)} 사용.
     */
    public Optional<User> findEntityByEmail(String email) {
        return userRepository.findByEmail(email);
    }
}
