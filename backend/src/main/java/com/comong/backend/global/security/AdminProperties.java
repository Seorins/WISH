package com.comong.backend.global.security;

import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * ADMIN 부트스트랩 대상 이메일 목록.
 *
 * <p>{@code application.yaml} 의 {@code security.admin.emails} 또는 환경변수 {@code SECURITY_ADMIN_EMAILS}
 * 로 주입된다 ({@link AdminBootstrapper}). 부팅 시 해당 이메일 사용자가 존재하면 USER → ADMIN 으로 promote.
 *
 * <p>이메일 리스트는 운영 비밀이 아니지만 환경별로 다를 수 있어 외부화. 운영에서 ADMIN 추가/제거 시 환경변수 변경 + 재배포가 필요한 트레이드오프를 감수한다.
 */
@ConfigurationProperties(prefix = "security.admin")
public record AdminProperties(List<String> emails) {

    public AdminProperties {
        // null 보다 빈 리스트가 호출 측에서 다루기 쉬움 (yaml 미설정 시 fallback).
        emails = emails == null ? List.of() : List.copyOf(emails);
    }
}
