package com.comong.backend.domain.exercise.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.comong.backend.domain.exercise.entity.ExerciseType;
import com.comong.backend.domain.exercise.entity.Motion;
import com.comong.backend.domain.exercise.repository.ExerciseSessionMotionRepository;
import com.comong.backend.domain.exercise.repository.ExerciseSessionRepository;
import com.comong.backend.domain.exercise.repository.MotionRepository;
import com.comong.backend.domain.patient.repository.PatientProfileRepository;
import com.comong.backend.domain.user.repository.UserRepository;
import com.comong.backend.support.IntegrationTestSupport;

import tools.jackson.databind.ObjectMapper;

@AutoConfigureMockMvc
class MotionControllerIntegrationTest extends IntegrationTestSupport {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private MotionRepository motionRepository;
    @Autowired private ExerciseSessionRepository exerciseSessionRepository;
    @Autowired private ExerciseSessionMotionRepository exerciseSessionMotionRepository;
    @Autowired private PatientProfileRepository patientProfileRepository;
    @Autowired private UserRepository userRepository;

    @BeforeEach
    void cleanDb() {
        cleanAll();
    }

    @AfterEach
    void cleanDbAfter() {
        cleanAll();
    }

    private void cleanAll() {
        exerciseSessionMotionRepository.deleteAll();
        exerciseSessionRepository.deleteAll();
        motionRepository.deleteAll();
        patientProfileRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void listMotions_returnsExerciseTypeMotionsOrderedByRoutineOrder() throws Exception {
        String token = setupUser("list@example.com", "list-user");
        motionRepository.save(motion(ExerciseType.TOP, "Side step", 2));
        motionRepository.save(motion(ExerciseType.TOP, "March", 1));
        motionRepository.save(motion(ExerciseType.DANIEL, "Stretch", 1));

        mockMvc.perform(
                        get("/exercise-motions")
                                .param("exerciseType", "TOP")
                                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("SUCCESS"))
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].name").value("March"))
                .andExpect(jsonPath("$.data[0].routineOrder").value(1))
                .andExpect(jsonPath("$.data[1].name").value("Side step"))
                .andExpect(jsonPath("$.data[1].routineOrder").value(2));
    }

    @Test
    void listMotions_requiresAuthentication() throws Exception {
        mockMvc.perform(get("/exercise-motions").param("exerciseType", "TOP"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("G-003"));
    }

    @Test
    void listMotions_rejectsMissingExerciseType() throws Exception {
        String token = setupUser("missing@example.com", "missing-user");

        mockMvc.perform(get("/exercise-motions").header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("G-001"));
    }

    private Motion motion(ExerciseType exerciseType, String name, int routineOrder) {
        return Motion.builder()
                .exerciseType(exerciseType)
                .name(name)
                .routineOrder(routineOrder)
                .targetReps(8)
                .description(name + " description.")
                .build();
    }

    private String setupUser(String email, String nickname) throws Exception {
        signup(email, nickname, "P@ssw0rd!");
        return login(email, "P@ssw0rd!");
    }

    private void signup(String email, String nickname, String password) throws Exception {
        mockMvc.perform(
                        post("/auth/signup")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"email\":\""
                                                + email
                                                + "\",\"nickname\":\""
                                                + nickname
                                                + "\",\"password\":\""
                                                + password
                                                + "\"}"))
                .andExpect(status().isCreated());
    }

    private String login(String email, String password) throws Exception {
        String body =
                mockMvc.perform(
                                post("/auth/login")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"email\":\""
                                                        + email
                                                        + "\",\"password\":\""
                                                        + password
                                                        + "\"}"))
                        .andExpect(status().isOk())
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        return objectMapper.readTree(body).get("data").get("accessToken").asString();
    }
}
