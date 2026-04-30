package com.comong.backend.global.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import com.comong.backend.domain.user.entity.UserRole;
import com.comong.backend.domain.user.repository.UserRepository;
import com.comong.backend.support.IntegrationTestSupport;

import tools.jackson.databind.ObjectMapper;

/**
 * 실제 인증 흐름 (회원가입 → 로그인 → JWT) 으로 ADMIN 권한이 보호되는지 검증한다.
 *
 * <p>기존 {@code with(user().roles("ADMIN"))} 테스트는 Spring Security Test 가 SecurityContext 를 직접 주입해
 * {@code JwtAuthenticationFilter} 를 우회하기 때문에 "실제 ADMIN 권한 발급 경로"는 검증되지 않았다 (S14P31E103-300).
 *
 * <p>본 테스트는 다음 두 사각지대를 메운다.
 *
 * <ul>
 *   <li>USER 로 가입한 사용자의 토큰으로는 admin endpoint 가 거부됨
 *   <li>{@code AdminBootstrapper} 로 promote 후 재로그인하면 같은 사용자가 admin endpoint 를 통과함
 * </ul>
 */
@AutoConfigureMockMvc
class AdminAuthorizationIntegrationTest extends IntegrationTestSupport {

    private static final String ADMIN_EMAIL = "admin-bootstrap@example.com";

    @DynamicPropertySource
    static void adminEmails(DynamicPropertyRegistry registry) {
        registry.add("security.admin.emails", () -> ADMIN_EMAIL);
    }

    @Autowired private MockMvc mockMvc;

    @Autowired private ObjectMapper objectMapper;

    @Autowired private UserRepository userRepository;

    @Autowired private AdminBootstrapper adminBootstrapper;

    @BeforeEach
    void cleanDb() {
        userRepository.deleteAll();
    }

    @Test
    void userTokenIsForbiddenOnAdminEndpoint() throws Exception {
        signup("user1@example.com", "user1", "P@ssw0rd!");
        String userToken = login("user1@example.com", "P@ssw0rd!");

        mockMvc.perform(
                        post("/exercise-motions")
                                .header("Authorization", "Bearer " + userToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(motionCreateBody("TOP", 1, "제자리 걷기")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("G-004"));
    }

    @Test
    void promotedUserPassesAdminEndpointAfterReLogin() throws Exception {
        // 1. ADMIN 부트스트랩 대상 이메일로 가입 — 이 시점엔 USER.
        signup(ADMIN_EMAIL, "admin1", "P@ssw0rd!");
        String beforeToken = login(ADMIN_EMAIL, "P@ssw0rd!");

        // 가입 직후 토큰은 USER 라 admin endpoint 거부.
        mockMvc.perform(
                        post("/exercise-motions")
                                .header("Authorization", "Bearer " + beforeToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(motionCreateBody("TOP", 2, "사이드 스텝")))
                .andExpect(status().isForbidden());

        // 2. 부트스트랩 실행 → DB role ADMIN 으로 갱신.
        adminBootstrapper.run(null);

        assertThat(userRepository.findByEmail(ADMIN_EMAIL).orElseThrow().getRole())
                .isEqualTo(UserRole.ADMIN);

        // 3. 재로그인 — 새 토큰엔 role=ADMIN claim.
        String afterToken = login(ADMIN_EMAIL, "P@ssw0rd!");

        // 4. 같은 사용자, 새 토큰으로 admin endpoint 통과 (201).
        mockMvc.perform(
                        post("/exercise-motions")
                                .header("Authorization", "Bearer " + afterToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(motionCreateBody("TOP", 3, "대각선 지르기")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value("SUCCESS"));
    }

    private void signup(String email, String nickname, String password) throws Exception {
        mockMvc.perform(
                        post("/auth/signup")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(json(new SignupPayload(email, nickname, password))))
                .andExpect(status().isCreated());
    }

    private String login(String email, String password) throws Exception {
        String response =
                mockMvc.perform(
                                post("/auth/login")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(json(new LoginPayload(email, password))))
                        .andExpect(status().isOk())
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        return objectMapper.readTree(response).get("data").get("accessToken").asString();
    }

    private String motionCreateBody(String exerciseType, int routineOrder, String name)
            throws Exception {
        return json(new MotionCreatePayload(exerciseType, name, routineOrder, 8, "테스트 동작"));
    }

    private String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }

    private record SignupPayload(String email, String nickname, String password) {}

    private record LoginPayload(String email, String password) {}

    private record MotionCreatePayload(
            String exerciseType,
            String name,
            int routineOrder,
            int targetReps,
            String description) {}
}
