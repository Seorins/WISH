package com.comong.backend.domain.user.service;

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

    @Transactional
    public UserResponse signup(UserSignupRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new BusinessException(UserErrorCode.EMAIL_DUPLICATED);
        }
        if (userRepository.existsByNickname(request.nickname())) {
            throw new BusinessException(UserErrorCode.NICKNAME_DUPLICATED);
        }
        User saved = userRepository.save(request.toEntity());
        return UserResponse.from(saved);
    }

    public UserResponse getUser(Long id) {
        User user =
                userRepository
                        .findById(id)
                        .orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));
        return UserResponse.from(user);
    }
}
