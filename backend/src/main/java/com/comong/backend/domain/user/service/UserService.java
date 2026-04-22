package com.comong.backend.domain.user.service;

import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.comong.backend.domain.user.dto.UserResponse;
import com.comong.backend.domain.user.entity.User;
import com.comong.backend.domain.user.exception.UserErrorCode;
import com.comong.backend.domain.user.repository.UserRepository;
import com.comong.backend.global.exception.BusinessException;

import lombok.RequiredArgsConstructor;

/**
 * User 도메인 유스케이스.
 *
 * <p>User 의 생명주기 중 '조회/수정/삭제' 를 담당한다. 계정 생성(회원가입)은 인증 영역이므로 {@code AuthService} 가 본 서비스의 {@link
 * #create(String, String, String)} 을 호출해 수행한다. 비밀번호 암호화는 호출 측 책임.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserService {

    private final UserRepository userRepository;

    /**
     * 새 User 생성. 이메일/닉네임 중복 검사 후 저장. 비밀번호는 이미 암호화된 값이어야 한다 (평문 금지).
     *
     * @throws BusinessException {@link UserErrorCode#EMAIL_DUPLICATED} / {@link
     *     UserErrorCode#NICKNAME_DUPLICATED}
     */
    @Transactional
    public UserResponse create(String email, String nickname, String encodedPassword) {
        if (userRepository.existsByEmail(email)) {
            throw new BusinessException(UserErrorCode.EMAIL_DUPLICATED);
        }
        if (userRepository.existsByNickname(nickname)) {
            throw new BusinessException(UserErrorCode.NICKNAME_DUPLICATED);
        }
        User saved =
                userRepository.save(
                        User.builder()
                                .email(email)
                                .nickname(nickname)
                                .password(encodedPassword)
                                .build());
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
