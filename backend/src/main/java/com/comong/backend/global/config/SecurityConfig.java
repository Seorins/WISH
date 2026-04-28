package com.comong.backend.global.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import com.comong.backend.global.security.JwtAuthenticationFilter;
import com.comong.backend.global.security.JwtProperties;
import com.comong.backend.global.security.RestAccessDeniedHandler;
import com.comong.backend.global.security.RestAuthenticationEntryPoint;

import lombok.RequiredArgsConstructor;

/**
 * 인증/인가 설정.
 *
 * <p>원칙: Stateless JWT 기반, 세션/CSRF/formLogin/httpBasic 모두 비활성. 공개 엔드포인트 외 전부 인증 필요.
 */
@Configuration
@RequiredArgsConstructor
@EnableConfigurationProperties(JwtProperties.class)
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final RestAuthenticationEntryPoint authenticationEntryPoint;
    private final RestAccessDeniedHandler accessDeniedHandler;

    /**
     * 인증/문서/헬스체크 관련 공개 엔드포인트.
     *
     * <p>{@code /uploads/**} 는 로컬 스토리지에 저장된 업로드 이미지를 정적 리소스로 서빙하기 위한 경로 (S14P31E103-217). 현재 정책은
     * "URL 만 알면 누구나 접근 가능" — UUID 기반 파일명으로 추측을 어렵게 했으나 비공개 작품 이미지에 대한 권한 체크는 없다. S14P31E103-218/219
     * 작업 시 인증된 컨트롤러로 다운로드 경로를 분리하면 이 항목을 제거한다.
     */
    private static final String[] PUBLIC_ENDPOINTS = {
        "/auth/**",
        "/actuator/health",
        "/v3/api-docs/**",
        "/swagger-ui.html",
        "/swagger-ui/**",
        "/uploads/**"
    };

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http.csrf(AbstractHttpConfigurer::disable)
                .cors(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(
                        auth ->
                                auth.requestMatchers(PUBLIC_ENDPOINTS)
                                        .permitAll()
                                        .anyRequest()
                                        .authenticated())
                .exceptionHandling(
                        e ->
                                e.authenticationEntryPoint(authenticationEntryPoint)
                                        .accessDeniedHandler(accessDeniedHandler))
                .addFilterBefore(
                        jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
