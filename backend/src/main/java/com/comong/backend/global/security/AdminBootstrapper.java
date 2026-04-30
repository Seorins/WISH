package com.comong.backend.global.security;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.comong.backend.domain.user.entity.User;
import com.comong.backend.domain.user.entity.UserRole;
import com.comong.backend.domain.user.repository.UserRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 부팅 시 {@link AdminProperties#emails()} 의 이메일에 해당하는 사용자를 ADMIN 으로 promote.
 *
 * <p>회원가입은 항상 USER 로 이루어지므로, ADMIN 부여는 운영자가 환경변수에 이메일을 등록하고 재배포하는 흐름이다.
 *
 * <ul>
 *   <li>해당 이메일 사용자가 미가입이면 경고 로그 후 skip — 보안상 자동 생성하지 않는다 (비밀번호 처리 부재).
 *   <li>이미 ADMIN 이면 skip.
 *   <li>리스트가 비어 있으면(yaml 미설정) 아무것도 하지 않는다.
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AdminBootstrapper implements ApplicationRunner {

    private final AdminProperties properties;
    private final UserRepository userRepository;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (properties.emails().isEmpty()) {
            return;
        }
        for (String email : properties.emails()) {
            User user = userRepository.findByEmail(email).orElse(null);
            if (user == null) {
                log.warn("ADMIN 부트스트랩 — 미가입 이메일 skip: {}", email);
                continue;
            }
            if (user.getRole() == UserRole.ADMIN) {
                continue;
            }
            user.promoteToAdmin();
            log.info("ADMIN promote 완료: {}", email);
        }
    }
}
