package com.comong.backend.global.config;

import java.util.Arrays;
import java.util.stream.Stream;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.util.matcher.RegexRequestMatcher;

import com.comong.backend.global.security.JwtAuthenticationFilter;
import com.comong.backend.global.security.JwtProperties;
import com.comong.backend.global.security.RestAccessDeniedHandler;
import com.comong.backend.global.security.RestAuthenticationEntryPoint;
import com.comong.backend.global.storage.StorageProperties;

import lombok.RequiredArgsConstructor;

/**
 * 인증/인가 설정.
 *
 * <p>원칙: Stateless JWT 기반, 세션/CSRF/formLogin/httpBasic 모두 비활성. 공개 엔드포인트 외 전부 인증 필요.
 *
 * <p>스토리지 prefix ({@link StorageProperties#publicUrlPrefix()}) 는 {@code STORAGE_PUBLIC_URL_PREFIX}
 * 환경변수로 운영에서 변경 가능하므로 하드코딩하지 않고 런타임에 합쳐넣는다 — 그래야 정적 핸들러 매핑과 Security permit 이 같은 source of truth 를
 * 공유한다.
 */
@Configuration
@RequiredArgsConstructor
@EnableConfigurationProperties(JwtProperties.class)
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final RestAuthenticationEntryPoint authenticationEntryPoint;
    private final RestAccessDeniedHandler accessDeniedHandler;
    private final StorageProperties storageProperties;

    /**
     * 인증/문서/헬스체크 관련 정적 공개 엔드포인트. 동적으로 합쳐지는 항목 (스토리지 prefix) 은 {@link
     * #securityFilterChain(HttpSecurity)} 에서 추가된다.
     *
     * <p>스토리지 prefix 는 로컬 업로드 이미지를 정적 리소스로 서빙하는 경로 (S14P31E103-217). 현재 정책은 "URL 만 알면 누구나 접근 가능" —
     * UUID 기반 파일명으로 추측을 어렵게 했으나 비공개 작품 이미지에 대한 권한 체크는 없다. S14P31E103-218/219 작업 시 인증된 컨트롤러로 다운로드
     * 경로를 분리하면 이 동적 추가도 제거한다.
     */
    private static final String[] STATIC_PUBLIC_ENDPOINTS = {
        "/auth/**", "/actuator/health", "/v3/api-docs/**", "/swagger-ui.html", "/swagger-ui/**"
    };

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        String storagePattern = stripTrailingSlash(storageProperties.publicUrlPrefix()) + "/**";
        String[] genericPublicEndpoints =
                Stream.concat(Arrays.stream(STATIC_PUBLIC_ENDPOINTS), Stream.of(storagePattern))
                        .toArray(String[]::new);

        http.csrf(AbstractHttpConfigurer::disable)
                .cors(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(
                        auth ->
                                auth
                                        // 1. 인증/문서/헬스체크/스토리지 정적 서빙 — 모든 메서드 허용
                                        .requestMatchers(genericPublicEndpoints)
                                        .permitAll()
                                        // 2. 공개 갤러리 (목록/상세 분리 안 하고 GET 만 허용)
                                        .requestMatchers(
                                                HttpMethod.GET,
                                                "/artworks/public",
                                                "/artworks/public/**")
                                        .permitAll()
                                        // 3. /artworks/me 는 본인 작품만이라 인증 필수 (밑의 catch 보다 먼저 매칭)
                                        .requestMatchers(HttpMethod.GET, "/artworks/me")
                                        .authenticated()
                                        // 4. GET /artworks/{id} — 비공개 작품 보호는 service 의
                                        //    ArtworkAccessChecker.verifyReadable 가 담당.
                                        //    비로그인 (anonymous) 접근 허용해서 공개 작품 상세를 외부 공유 가능.
                                        //    숫자 ID 만 매칭하도록 정규식으로 제한 — 미래에 /artworks/something
                                        //    같은 임의 segment 가 추가돼도 의도치 않게 permitAll 에 포함되지 않음.
                                        .requestMatchers(
                                                RegexRequestMatcher.regexMatcher(
                                                        HttpMethod.GET, "/artworks/\\d+"))
                                        .permitAll()
                                        // 5. 그 외 모든 요청 (POST/PATCH/DELETE on artworks 포함) — 인증 필수
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

    private static String stripTrailingSlash(String s) {
        return s.endsWith("/") ? s.substring(0, s.length() - 1) : s;
    }
}
