package com.comong.backend.domain.exercise.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.comong.backend.domain.exercise.entity.ExerciseSession;
import com.comong.backend.domain.exercise.entity.ExerciseSessionMotion;
import com.comong.backend.domain.exercise.entity.ExerciseType;
import com.comong.backend.domain.exercise.entity.Motion;
import com.comong.backend.domain.exercise.repository.ExerciseSessionMotionRepository;
import com.comong.backend.domain.exercise.repository.ExerciseSessionRepository;
import com.comong.backend.domain.exercise.repository.MotionRepository;
import com.comong.backend.domain.patient.entity.PatientProfile;
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
    void createMotion_persistsAndReturnsLocation() throws Exception {
        String token = setupUser("create@example.com", "create-user");

        mockMvc.perform(
                        post("/exercise-motions")
                                .header("Authorization", "Bearer " + token)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"exerciseType\":\"TOP\",\"name\":\"March\",\"routineOrder\":1,"
                                                + "\"targetReps\":8,\"description\":\"Walk in place.\","
                                                + "\"demoVideoUrl\":\"https://example.com/march.mp4\","
                                                + "\"thumbnailUrl\":\"https://example.com/march.png\"}"))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", startsWith("/exercise-motions/")))
                .andExpect(jsonPath("$.code").value("SUCCESS"))
                .andExpect(jsonPath("$.data.id").isNumber())
                .andExpect(jsonPath("$.data.exerciseType").value("TOP"))
                .andExpect(jsonPath("$.data.name").value("March"))
                .andExpect(jsonPath("$.data.routineOrder").value(1))
                .andExpect(jsonPath("$.data.targetReps").value(8))
                .andExpect(jsonPath("$.data.demoVideoUrl").value("https://example.com/march.mp4"))
                .andExpect(jsonPath("$.data.thumbnailUrl").value("https://example.com/march.png"));

        assertThat(motionRepository.count()).isEqualTo(1);
    }

    @Test
    void createMotion_rejectsDuplicatedRoutineOrderInSameExerciseType() throws Exception {
        String token = setupUser("duplicate@example.com", "duplicate-user");
        motionRepository.save(motion(ExerciseType.TOP, "March", 1));

        mockMvc.perform(
                        post("/exercise-motions")
                                .header("Authorization", "Bearer " + token)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"exerciseType\":\"TOP\",\"name\":\"Side step\","
                                                + "\"routineOrder\":1,\"targetReps\":8,"
                                                + "\"description\":\"Move side to side.\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EX-002"));
    }

    @Test
    void deleteMotion_removesMotion() throws Exception {
        String token = setupUser("delete@example.com", "delete-user");
        Motion saved = motionRepository.save(motion(ExerciseType.TOP, "March", 1));

        mockMvc.perform(
                        delete("/exercise-motions/{id}", saved.getId())
                                .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        assertThat(motionRepository.existsById(saved.getId())).isFalse();
    }

    @Test
    void deleteMotion_rejectsUnknownMotion() throws Exception {
        String token = setupUser("missing@example.com", "missing-user");

        mockMvc.perform(
                        delete("/exercise-motions/{id}", 999999L)
                                .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("EX-001"));
    }

    @Test
    void deleteMotion_rejectsMotionUsedBySessionResult() throws Exception {
        String token = setupUserWithProfile("inuse@example.com", "inuse-user");
        PatientProfile patientProfile = patientProfileRepository.findAll().get(0);
        Motion motion = motionRepository.save(motion(ExerciseType.TOP, "March", 1));
        ExerciseSession session =
                exerciseSessionRepository.save(
                        ExerciseSession.builder()
                                .patientProfile(patientProfile)
                                .exerciseType(ExerciseType.TOP)
                                .durationSec(78)
                                .averageAccuracy(0.87)
                                .completedMotionCount(1)
                                .build());
        exerciseSessionMotionRepository.save(
                ExerciseSessionMotion.builder()
                        .session(session)
                        .motion(motion)
                        .durationSec(12)
                        .accuracy(0.91)
                        .completedReps(8)
                        .feedback("Good")
                        .build());

        mockMvc.perform(
                        delete("/exercise-motions/{id}", motion.getId())
                                .header("Authorization", "Bearer " + token))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EX-003"));

        assertThat(motionRepository.existsById(motion.getId())).isTrue();
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

    private String setupUserWithProfile(String email, String nickname) throws Exception {
        String token = setupUser(email, nickname);
        mockMvc.perform(
                        post("/patient-profiles")
                                .header("Authorization", "Bearer " + token)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"name\":\"Patient\",\"nickname\":\"patient\","
                                                + "\"birthDate\":\"2020-01-01\",\"gender\":\"MALE\"}"))
                .andExpect(status().isCreated());
        return token;
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
