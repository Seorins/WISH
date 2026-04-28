package com.comong.backend.domain.auth.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import com.comong.backend.domain.patient.repository.PatientProfileRepository;
import com.comong.backend.domain.user.repository.UserRepository;
import com.comong.backend.support.IntegrationTestSupport;

import tools.jackson.databind.ObjectMapper;

@AutoConfigureMockMvc
class DemoAuthControllerIntegrationTest extends IntegrationTestSupport {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private PatientProfileRepository patientProfileRepository;
    @Autowired private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        patientProfileRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void demoTokenIssuesJwtAndCreatesDemoProfile() throws Exception {
        String token = issueDemoToken();

        mockMvc.perform(get("/users/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value("demo@comong.local"))
                .andExpect(jsonPath("$.data.nickname").value("comong-demo"));
        assertThat(userRepository.count()).isEqualTo(1);
        assertThat(patientProfileRepository.count()).isEqualTo(1);
    }

    @Test
    void demoTokenReusesExistingDemoUserAndProfile() throws Exception {
        issueDemoToken();
        issueDemoToken();

        assertThat(userRepository.count()).isEqualTo(1);
        assertThat(patientProfileRepository.count()).isEqualTo(1);
    }

    private String issueDemoToken() throws Exception {
        String body =
                mockMvc.perform(post("/auth/demo-token"))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.code").value("SUCCESS"))
                        .andExpect(jsonPath("$.data.accessToken").isString())
                        .andExpect(jsonPath("$.data.tokenType").value("Bearer"))
                        .andExpect(jsonPath("$.data.expiresIn").isNumber())
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        return objectMapper.readTree(body).get("data").get("accessToken").asString();
    }
}
