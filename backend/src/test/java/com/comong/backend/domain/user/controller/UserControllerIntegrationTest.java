package com.comong.backend.domain.user.controller;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import com.comong.backend.domain.user.entity.User;
import com.comong.backend.domain.user.entity.UserRole;
import com.comong.backend.domain.user.repository.UserRepository;
import com.comong.backend.support.IntegrationTestSupport;

@AutoConfigureMockMvc
class UserControllerIntegrationTest extends IntegrationTestSupport {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
    }

    @Test
    void listUsers_byAdminReturnsUsers() throws Exception {
        userRepository.save(userEntity("guardian@example.com", "guardian", UserRole.USER));
        userRepository.save(userEntity("admin@example.com", "admin", UserRole.ADMIN));

        mockMvc.perform(get("/users").with(user("admin").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("SUCCESS"))
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(
                        jsonPath("$.data[*].email")
                                .value(
                                        containsInAnyOrder(
                                                "guardian@example.com", "admin@example.com")))
                .andExpect(jsonPath("$.data[*].role").value(containsInAnyOrder("USER", "ADMIN")))
                .andExpect(jsonPath("$.data[0].createdAt").isString());
    }

    @Test
    void listUsers_byUserIsForbidden() throws Exception {
        mockMvc.perform(get("/users").with(user("user").roles("USER")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("G-004"));
    }

    private User userEntity(String email, String nickname, UserRole role) {
        return User.builder()
                .email(email)
                .nickname(nickname)
                .password("encoded-password")
                .role(role)
                .build();
    }
}
