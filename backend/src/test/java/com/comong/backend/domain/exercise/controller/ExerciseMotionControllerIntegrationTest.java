package com.comong.backend.domain.exercise.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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

import com.comong.backend.domain.exercise.entity.ExerciseMotion;
import com.comong.backend.domain.exercise.entity.ExerciseSession;
import com.comong.backend.domain.exercise.entity.ExerciseSessionMotion;
import com.comong.backend.domain.exercise.entity.ExerciseType;
import com.comong.backend.domain.exercise.repository.ExerciseMotionRepository;
import com.comong.backend.domain.exercise.repository.ExerciseSessionMotionRepository;
import com.comong.backend.domain.exercise.repository.ExerciseSessionRepository;
import com.comong.backend.domain.patient.entity.PatientProfile;
import com.comong.backend.domain.patient.repository.PatientProfileRepository;
import com.comong.backend.domain.user.repository.UserRepository;
import com.comong.backend.support.IntegrationTestSupport;

import tools.jackson.databind.ObjectMapper;

@AutoConfigureMockMvc
class ExerciseMotionControllerIntegrationTest extends IntegrationTestSupport {

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
    void listExerciseMotions_returnsExerciseTypeMotionsOrderedByRoutineOrder() throws Exception {
        String token = setupUser("list@example.com", "list-user");
        exerciseMotionRepository.save(exerciseMotion(ExerciseType.TOP, "Side step", 2));
        exerciseMotionRepository.save(exerciseMotion(ExerciseType.TOP, "March", 1));
        exerciseMotionRepository.save(exerciseMotion(ExerciseType.DANIEL, "Stretch", 1));

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
    void getExerciseMotionDetail_returnsMotion() throws Exception {
        String token = setupUser("detail@example.com", "detail-user");
        ExerciseMotion motion =
                exerciseMotionRepository.save(exerciseMotion(ExerciseType.TOP, "March", 1));

        mockMvc.perform(
                        get("/exercise-motions/{id}", motion.getId())
                                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("SUCCESS"))
                .andExpect(jsonPath("$.data.id").value(motion.getId()))
                .andExpect(jsonPath("$.data.name").value("March"));
    }

    @Test
    void createExerciseMotion_byAdminPersistsAndReturnsLocation() throws Exception {
        mockMvc.perform(
                        post("/exercise-motions")
                                .with(user("admin").roles("ADMIN"))
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
                .andExpect(jsonPath("$.data.targetReps").value(8));

        assertThat(exerciseMotionRepository.count()).isEqualTo(1);
    }

    @Test
    void createExerciseMotion_byUserIsForbidden() throws Exception {
        mockMvc.perform(
                        post("/exercise-motions")
                                .with(user("user").roles("USER"))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"exerciseType\":\"TOP\",\"name\":\"March\",\"routineOrder\":1,"
                                                + "\"targetReps\":8,\"description\":\"Walk in place.\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("G-004"));

        assertThat(exerciseMotionRepository.count()).isZero();
    }

    @Test
    void createExerciseMotion_rejectsDuplicatedRoutineOrderInSameExerciseType() throws Exception {
        exerciseMotionRepository.save(exerciseMotion(ExerciseType.TOP, "March", 1));

        mockMvc.perform(
                        post("/exercise-motions")
                                .with(user("admin").roles("ADMIN"))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"exerciseType\":\"TOP\",\"name\":\"Side step\","
                                                + "\"routineOrder\":1,\"targetReps\":8,"
                                                + "\"description\":\"Move side to side.\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EX-002"));
    }

    @Test
    void updateExerciseMotion_byAdminUpdatesAllowedFields() throws Exception {
        ExerciseMotion saved =
                exerciseMotionRepository.save(
                        ExerciseMotion.builder()
                                .exerciseType(ExerciseType.TOP)
                                .name("March")
                                .routineOrder(1)
                                .targetReps(8)
                                .description("Walk in place.")
                                .demoVideoUrl("https://example.com/old.mp4")
                                .thumbnailUrl("https://example.com/old.png")
                                .build());

        mockMvc.perform(
                        patch("/exercise-motions/{id}", saved.getId())
                                .with(user("admin").roles("ADMIN"))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"name\":\"March updated\",\"targetReps\":10,"
                                                + "\"description\":\"Updated description.\","
                                                + "\"demoVideoUrl\":\"https://example.com/new.mp4\","
                                                + "\"thumbnailUrl\":\"https://example.com/new.png\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("SUCCESS"))
                .andExpect(jsonPath("$.data.id").value(saved.getId()))
                .andExpect(jsonPath("$.data.exerciseType").value("TOP"))
                .andExpect(jsonPath("$.data.routineOrder").value(1))
                .andExpect(jsonPath("$.data.name").value("March updated"))
                .andExpect(jsonPath("$.data.targetReps").value(10))
                .andExpect(jsonPath("$.data.description").value("Updated description."))
                .andExpect(jsonPath("$.data.demoVideoUrl").value("https://example.com/new.mp4"))
                .andExpect(jsonPath("$.data.thumbnailUrl").value("https://example.com/new.png"));

        ExerciseMotion updated = exerciseMotionRepository.findById(saved.getId()).orElseThrow();
        assertThat(updated.getExerciseType()).isEqualTo(ExerciseType.TOP);
        assertThat(updated.getRoutineOrder()).isEqualTo(1);
        assertThat(updated.getName()).isEqualTo("March updated");
        assertThat(updated.getTargetReps()).isEqualTo(10);
    }

    @Test
    void updateExerciseMotion_byUserIsForbidden() throws Exception {
        ExerciseMotion saved =
                exerciseMotionRepository.save(exerciseMotion(ExerciseType.TOP, "March", 1));

        mockMvc.perform(
                        patch("/exercise-motions/{id}", saved.getId())
                                .with(user("user").roles("USER"))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"name\":\"March updated\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("G-004"));

        assertThat(exerciseMotionRepository.findById(saved.getId()).orElseThrow().getName())
                .isEqualTo("March");
    }

    @Test
    void updateExerciseMotion_rejectsUnknownMotion() throws Exception {
        mockMvc.perform(
                        patch("/exercise-motions/{id}", 999_999L)
                                .with(user("admin").roles("ADMIN"))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"name\":\"March updated\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("EX-001"));
    }

    @Test
    void updateExerciseMotion_rejectsInvalidInput() throws Exception {
        ExerciseMotion saved =
                exerciseMotionRepository.save(exerciseMotion(ExerciseType.TOP, "March", 1));

        mockMvc.perform(
                        patch("/exercise-motions/{id}", saved.getId())
                                .with(user("admin").roles("ADMIN"))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"name\":\"   \",\"targetReps\":0}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("G-001"));

        ExerciseMotion unchanged = exerciseMotionRepository.findById(saved.getId()).orElseThrow();
        assertThat(unchanged.getName()).isEqualTo("March");
        assertThat(unchanged.getTargetReps()).isEqualTo(8);
    }

    @Test
    void deleteExerciseMotion_byAdminRemovesMotion() throws Exception {
        ExerciseMotion saved =
                exerciseMotionRepository.save(exerciseMotion(ExerciseType.TOP, "March", 1));

        mockMvc.perform(
                        delete("/exercise-motions/{id}", saved.getId())
                                .with(user("admin").roles("ADMIN")))
                .andExpect(status().isNoContent());

        assertThat(exerciseMotionRepository.existsById(saved.getId())).isFalse();
    }

    @Test
    void deleteExerciseMotion_byUserIsForbidden() throws Exception {
        ExerciseMotion saved =
                exerciseMotionRepository.save(exerciseMotion(ExerciseType.TOP, "March", 1));

        mockMvc.perform(
                        delete("/exercise-motions/{id}", saved.getId())
                                .with(user("user").roles("USER")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("G-004"));

        assertThat(exerciseMotionRepository.existsById(saved.getId())).isTrue();
    }

    @Test
    void deleteExerciseMotion_rejectsMotionUsedBySessionResult() throws Exception {
        String token = setupUserWithProfile("inuse@example.com", "inuse-user");
        PatientProfile patientProfile = patientProfileRepository.findAll().get(0);
        ExerciseMotion motion =
                exerciseMotionRepository.save(exerciseMotion(ExerciseType.TOP, "March", 1));
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
                        .exerciseMotion(motion)
                        .durationSec(12)
                        .accuracy(0.91)
                        .completedReps(8)
                        .feedback("Good")
                        .build());

        mockMvc.perform(
                        delete("/exercise-motions/{id}", motion.getId())
                                .with(user("admin").roles("ADMIN")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EX-003"));

        assertThat(exerciseMotionRepository.existsById(motion.getId())).isTrue();
    }

    @Test
    void listExerciseMotions_requiresAuthentication() throws Exception {
        mockMvc.perform(get("/exercise-motions").param("exerciseType", "TOP"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("G-003"));
    }

    @Test
    void listExerciseMotions_rejectsMissingExerciseType() throws Exception {
        String token = setupUser("missing@example.com", "missing-user");

        mockMvc.perform(get("/exercise-motions").header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("G-001"));
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
