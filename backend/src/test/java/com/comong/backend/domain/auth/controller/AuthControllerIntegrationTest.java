package com.comong.backend.domain.auth.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.comong.backend.domain.patient.repository.PatientProfileRepository;
import com.comong.backend.domain.user.repository.UserRepository;
import com.comong.backend.support.IntegrationTestSupport;

import tools.jackson.databind.ObjectMapper;

@AutoConfigureMockMvc
class AuthControllerIntegrationTest extends IntegrationTestSupport {

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
    void signupCreatesUser() throws Exception {
        mockMvc.perform(
                        post("/auth/signup")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        json(
                                                new SignupPayload(
                                                        "guardian1@example.com",
                                                        "guardian1",
                                                        "P@ssw0rd!"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value("SUCCESS"))
                .andExpect(jsonPath("$.data.id").isNumber())
                .andExpect(jsonPath("$.data.email").value("guardian1@example.com"))
                .andExpect(jsonPath("$.data.nickname").value("guardian1"));
    }

    @Test
    void signupRejectsInvalidRequest() throws Exception {
        mockMvc.perform(
                        post("/auth/signup")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(json(new SignupPayload("invalid-email", "g", "weakpass"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("G-001"))
                .andExpect(jsonPath("$.errors.email").exists())
                .andExpect(jsonPath("$.errors.nickname").exists())
                .andExpect(jsonPath("$.errors.password").exists());
    }

    @Test
    void signupRejectsDuplicatedEmail() throws Exception {
        signup("guardian2@example.com", "guardian2", "P@ssw0rd!");

        mockMvc.perform(
                        post("/auth/signup")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        json(
                                                new SignupPayload(
                                                        "guardian2@example.com",
                                                        "guardian2-other",
                                                        "P@ssw0rd!"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("U-002"));
    }

    @Test
    void signupRejectsDuplicatedNickname() throws Exception {
        signup("guardian3@example.com", "guardian3", "P@ssw0rd!");

        mockMvc.perform(
                        post("/auth/signup")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        json(
                                                new SignupPayload(
                                                        "guardian3-other@example.com",
                                                        "guardian3",
                                                        "P@ssw0rd!"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("U-003"));
    }

    @Test
    void loginIssuesAccessToken() throws Exception {
        signup("guardian4@example.com", "guardian4", "P@ssw0rd!");

        mockMvc.perform(
                        post("/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        json(
                                                new LoginPayload(
                                                        "guardian4@example.com", "P@ssw0rd!"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("SUCCESS"))
                .andExpect(jsonPath("$.data.accessToken").isString())
                .andExpect(jsonPath("$.data.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.data.expiresIn").isNumber());
    }

    @Test
    void loginRejectsInvalidCredentials() throws Exception {
        signup("guardian5@example.com", "guardian5", "P@ssw0rd!");

        mockMvc.perform(
                        post("/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        json(
                                                new LoginPayload(
                                                        "guardian5@example.com",
                                                        "WrongP@ssw0rd!"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("A-001"));
    }

    @Test
    void demoTokenEndpointIsNotProvided() throws Exception {
        mockMvc.perform(post("/auth/demo-token"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("G-005"));
    }

    @Test
    void meRejectsUnauthenticatedRequest() throws Exception {
        mockMvc.perform(get("/users/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("G-003"));
    }

    @Test
    void meReturnsCurrentUserWithAccessToken() throws Exception {
        signup("guardian6@example.com", "guardian6", "P@ssw0rd!");
        String accessToken = login("guardian6@example.com", "P@ssw0rd!");

        mockMvc.perform(get("/users/me").header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("SUCCESS"))
                .andExpect(jsonPath("$.data.email").value("guardian6@example.com"))
                .andExpect(jsonPath("$.data.nickname").value("guardian6"));
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

    private String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }

    private record SignupPayload(String email, String nickname, String password) {}

    private record LoginPayload(String email, String password) {}
}
