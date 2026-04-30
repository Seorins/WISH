package com.comong.backend.domain.exercise.controller;

import static org.assertj.core.api.Assertions.assertThat;
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

import com.comong.backend.domain.exercise.entity.ExerciseMotion;
import com.comong.backend.domain.exercise.entity.ExerciseType;
import com.comong.backend.domain.exercise.repository.ExerciseMotionRepository;
import com.comong.backend.domain.exercise.repository.ExerciseSessionMotionRepository;
import com.comong.backend.domain.exercise.repository.ExerciseSessionRepository;
import com.comong.backend.domain.patient.repository.PatientProfileRepository;
import com.comong.backend.domain.user.repository.UserRepository;
import com.comong.backend.support.IntegrationTestSupport;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@AutoConfigureMockMvc
class ExerciseSessionControllerIntegrationTest extends IntegrationTestSupport {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private ExerciseMotionRepository exerciseMotionRepository;
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
        exerciseMotionRepository.deleteAll();
        patientProfileRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void createExerciseSession_persistsSessionAndMotionResults() throws Exception {
        TestUser user = setupUserWithProfile("session@example.com", "session-user");
        ExerciseMotion march = exerciseMotionRepository.save(exerciseMotion("March", 1));
        ExerciseMotion sideStep = exerciseMotionRepository.save(exerciseMotion("Side step", 2));

        mockMvc.perform(
                        post("/exercise-sessions")
                                .header("Authorization", "Bearer " + user.token())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        """
                                        {
                                          "patientProfileId": %d,
                                          "exerciseType": "TOP",
                                          "durationSec": 78,
                                          "averageAccuracy": 0.87,
                                          "motions": [
                                            {
                                              "exerciseMotionId": %d,
                                              "durationSec": 12,
                                              "accuracy": 0.91,
                                              "completedReps": 8,
                                              "feedback": "무릎을 조금 더 올려요"
                                            },
                                            {
                                              "exerciseMotionId": %d,
                                              "durationSec": 14,
                                              "accuracy": 0.88,
                                              "completedReps": 8,
                                              "feedback": "팔꿈치를 어깨 높이까지 올려요"
                                            }
                                          ]
                                        }
                                        """
                                                .formatted(
                                                        user.patientProfileId(),
                                                        march.getId(),
                                                        sideStep.getId())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value("SUCCESS"))
                .andExpect(jsonPath("$.data.id").isNumber())
                .andExpect(jsonPath("$.data.patientProfileId").value(user.patientProfileId()))
                .andExpect(jsonPath("$.data.exerciseType").value("TOP"))
                .andExpect(jsonPath("$.data.durationSec").value(78))
                .andExpect(jsonPath("$.data.averageAccuracy").value(0.87))
                .andExpect(jsonPath("$.data.completedMotionCount").value(2))
                .andExpect(jsonPath("$.data.motions.length()").value(2))
                .andExpect(jsonPath("$.data.motions[0].exerciseMotionId").value(march.getId()))
                .andExpect(jsonPath("$.data.motions[0].motionName").value("March"))
                .andExpect(jsonPath("$.data.motions[0].routineOrder").value(1))
                .andExpect(jsonPath("$.data.motions[0].completedReps").value(8));

        assertThat(exerciseSessionRepository.count()).isEqualTo(1);
        assertThat(exerciseSessionMotionRepository.count()).isEqualTo(2);
    }

    @Test
    void createExerciseSession_rejectsOtherUsersPatientProfile() throws Exception {
        TestUser owner = setupUserWithProfile("owner@example.com", "owner-user");
        TestUser other = setupUserWithProfile("other@example.com", "other-user");
        ExerciseMotion motion = exerciseMotionRepository.save(exerciseMotion("March", 1));

        mockMvc.perform(
                        post("/exercise-sessions")
                                .header("Authorization", "Bearer " + other.token())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        saveRequest(
                                                owner.patientProfileId(), motion.getId(), "TOP")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("P-001"));

        assertThat(exerciseSessionRepository.count()).isZero();
        assertThat(exerciseSessionMotionRepository.count()).isZero();
    }

    @Test
    void createExerciseSession_rejectsUnknownMotion() throws Exception {
        TestUser user = setupUserWithProfile("unknown@example.com", "unknown-user");

        mockMvc.perform(
                        post("/exercise-sessions")
                                .header("Authorization", "Bearer " + user.token())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(saveRequest(user.patientProfileId(), 999_999L, "TOP")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("EX-001"));

        assertThat(exerciseSessionRepository.count()).isZero();
        assertThat(exerciseSessionMotionRepository.count()).isZero();
    }

    @Test
    void createExerciseSession_rejectsMotionTypeMismatch() throws Exception {
        TestUser user = setupUserWithProfile("mismatch@example.com", "mismatch-user");
        ExerciseMotion motion =
                exerciseMotionRepository.save(
                        exerciseMotion(ExerciseType.DANIEL, "Daniel stretch", 1));

        mockMvc.perform(
                        post("/exercise-sessions")
                                .header("Authorization", "Bearer " + user.token())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        saveRequest(
                                                user.patientProfileId(), motion.getId(), "TOP")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("EX-004"));

        assertThat(exerciseSessionRepository.count()).isZero();
        assertThat(exerciseSessionMotionRepository.count()).isZero();
    }

    @Test
    void createExerciseSession_rejectsEmptyMotions() throws Exception {
        TestUser user = setupUserWithProfile("empty@example.com", "empty-user");

        mockMvc.perform(
                        post("/exercise-sessions")
                                .header("Authorization", "Bearer " + user.token())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        """
                                        {
                                          "patientProfileId": %d,
                                          "exerciseType": "TOP",
                                          "durationSec": 78,
                                          "averageAccuracy": 0.87,
                                          "motions": []
                                        }
                                        """
                                                .formatted(user.patientProfileId())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("G-001"));

        assertThat(exerciseSessionRepository.count()).isZero();
        assertThat(exerciseSessionMotionRepository.count()).isZero();
    }

    @Test
    void createExerciseSession_rejectsNullMotionElement() throws Exception {
        TestUser user = setupUserWithProfile("null-motion@example.com", "null-motion-user");

        mockMvc.perform(
                        post("/exercise-sessions")
                                .header("Authorization", "Bearer " + user.token())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        """
                                        {
                                          "patientProfileId": %d,
                                          "exerciseType": "TOP",
                                          "durationSec": 78,
                                          "averageAccuracy": 0.87,
                                          "motions": [null]
                                        }
                                        """
                                                .formatted(user.patientProfileId())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("G-001"));

        assertThat(exerciseSessionRepository.count()).isZero();
        assertThat(exerciseSessionMotionRepository.count()).isZero();
    }

    @Test
    void createExerciseSession_requiresAuthentication() throws Exception {
        mockMvc.perform(
                        post("/exercise-sessions")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(saveRequest(1L, 1L, "TOP")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("G-003"));
    }

    private ExerciseMotion exerciseMotion(String name, int routineOrder) {
        return exerciseMotion(ExerciseType.TOP, name, routineOrder);
    }

    private ExerciseMotion exerciseMotion(
            ExerciseType exerciseType, String name, int routineOrder) {
        return ExerciseMotion.builder()
                .exerciseType(exerciseType)
                .name(name)
                .routineOrder(routineOrder)
                .targetReps(8)
                .description(name + " description.")
                .build();
    }

    private String saveRequest(Long patientProfileId, Long exerciseMotionId, String exerciseType) {
        return """
                {
                  "patientProfileId": %d,
                  "exerciseType": "%s",
                  "durationSec": 78,
                  "averageAccuracy": 0.87,
                  "motions": [
                    {
                      "exerciseMotionId": %d,
                      "durationSec": 12,
                      "accuracy": 0.91,
                      "completedReps": 8,
                      "feedback": "무릎을 조금 더 올려요"
                    }
                  ]
                }
                """
                .formatted(patientProfileId, exerciseType, exerciseMotionId);
    }

    private TestUser setupUserWithProfile(String email, String nickname) throws Exception {
        String token = setupUser(email, nickname);
        String body =
                mockMvc.perform(
                                post("/patient-profiles")
                                        .header("Authorization", "Bearer " + token)
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"name\":\"Patient\",\"nickname\":\"patient\","
                                                        + "\"birthDate\":\"2020-01-01\","
                                                        + "\"gender\":\"MALE\"}"))
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        JsonNode response = objectMapper.readTree(body);
        return new TestUser(token, response.get("data").get("id").asLong());
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

    private record TestUser(String token, Long patientProfileId) {}
}
