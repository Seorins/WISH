package com.comong.backend.domain.exercise.controller;

import static org.assertj.core.api.Assertions.assertThat;
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
    void createExerciseSession_persistsRawAndCompactPoseReplay() throws Exception {
        TestUser user = setupUserWithProfile("replay@example.com", "replay-user");
        ExerciseMotion march = exerciseMotionRepository.save(exerciseMotion("March", 1));

        String body =
                mockMvc.perform(
                                post("/exercise-sessions")
                                        .header("Authorization", "Bearer " + user.token())
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                """
                                                {
                                                  "patientProfileId": %d,
                                                  "exerciseType": "TOP",
                                                  "durationSec": 12,
                                                  "averageAccuracy": 0.91,
                                                  "motions": [
                                                    {
                                                      "exerciseMotionId": %d,
                                                      "durationSec": 12,
                                                      "accuracy": 0.91,
                                                      "completedReps": 8,
                                                      "feedback": "Good",
                                                      "poseReplay": %s,
                                                      "compactPoseReplay": %s
                                                    }
                                                  ]
                                                }
                                                """
                                                        .formatted(
                                                                user.patientProfileId(),
                                                                march.getId(),
                                                                replayJson(30, 67, "raw window"),
                                                                replayJson(
                                                                        5,
                                                                        400,
                                                                        "compact count window"))))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.data.motions[0].replayAvailable").value(true))
                        .andReturn()
                        .getResponse()
                        .getContentAsString();

        JsonNode motion = objectMapper.readTree(body).get("data").get("motions").get(0);
        Long motionResultId = motion.get("id").asLong();

        ExerciseSessionMotion savedMotion =
                exerciseSessionMotionRepository.findById(motionResultId).orElseThrow();
        assertThat(savedMotion.getPoseReplay()).isNotBlank();
        assertThat(savedMotion.getCompactPoseReplay()).isNotBlank();

        mockMvc.perform(
                        get("/exercise-sessions/motions/{motionResultId}/replay", motionResultId)
                                .header("Authorization", "Bearer " + user.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.replayAvailable").value(true))
                .andExpect(jsonPath("$.data.replay.fps").value(30))
                .andExpect(jsonPath("$.data.compactReplay.fps").value(5))
                .andExpect(
                        jsonPath("$.data.compactReplay.markers[0].reason")
                                .value("compact count window"));
    }

    @Test
    void listExerciseSessions_returnsOwnedPatientSessionsOrderedByCreatedAtDesc() throws Exception {
        TestUser user = setupUserWithProfile("list-session@example.com", "list-session-user");
        PatientProfile profile = findProfile(user);
        ExerciseSession older =
                exerciseSessionRepository.save(exerciseSession(profile, 60, 0.8, 1));
        Thread.sleep(5);
        ExerciseSession newer =
                exerciseSessionRepository.save(exerciseSession(profile, 78, 0.87, 2));

        mockMvc.perform(
                        get("/exercise-sessions")
                                .header("Authorization", "Bearer " + user.token())
                                .param("patientProfileId", user.patientProfileId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("SUCCESS"))
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].id").value(newer.getId()))
                .andExpect(jsonPath("$.data[0].durationSec").value(78))
                .andExpect(jsonPath("$.data[1].id").value(older.getId()))
                .andExpect(jsonPath("$.data[1].durationSec").value(60));
    }

    @Test
    void listExerciseSessions_rejectsOtherUsersPatientProfile() throws Exception {
        TestUser owner = setupUserWithProfile("list-owner@example.com", "list-owner-user");
        TestUser other = setupUserWithProfile("list-other@example.com", "list-other-user");

        mockMvc.perform(
                        get("/exercise-sessions")
                                .header("Authorization", "Bearer " + other.token())
                                .param("patientProfileId", owner.patientProfileId().toString()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("P-001"));
    }

    @Test
    void getExerciseSessionDetail_returnsOwnedSessionWithMotionsOrderedByRoutineOrder()
            throws Exception {
        TestUser user = setupUserWithProfile("detail-session@example.com", "detail-session-user");
        PatientProfile profile = findProfile(user);
        ExerciseMotion march = exerciseMotionRepository.save(exerciseMotion("March", 1));
        ExerciseMotion sideStep = exerciseMotionRepository.save(exerciseMotion("Side step", 2));
        ExerciseSession session =
                exerciseSessionRepository.save(exerciseSession(profile, 78, 0.87, 2));
        exerciseSessionMotionRepository.save(sessionMotion(session, sideStep, 14, 0.88));
        exerciseSessionMotionRepository.save(sessionMotion(session, march, 12, 0.91));

        mockMvc.perform(
                        get("/exercise-sessions/{id}", session.getId())
                                .header("Authorization", "Bearer " + user.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("SUCCESS"))
                .andExpect(jsonPath("$.data.id").value(session.getId()))
                .andExpect(jsonPath("$.data.patientProfileId").value(user.patientProfileId()))
                .andExpect(jsonPath("$.data.motions.length()").value(2))
                .andExpect(jsonPath("$.data.motions[0].exerciseMotionId").value(march.getId()))
                .andExpect(jsonPath("$.data.motions[0].routineOrder").value(1))
                .andExpect(jsonPath("$.data.motions[1].exerciseMotionId").value(sideStep.getId()))
                .andExpect(jsonPath("$.data.motions[1].routineOrder").value(2));
    }

    @Test
    void getExerciseSessionDetail_rejectsOtherUsersSession() throws Exception {
        TestUser owner = setupUserWithProfile("detail-owner@example.com", "detail-owner-user");
        TestUser other = setupUserWithProfile("detail-other@example.com", "detail-other-user");
        ExerciseSession session =
                exerciseSessionRepository.save(exerciseSession(findProfile(owner), 78, 0.87, 1));

        mockMvc.perform(
                        get("/exercise-sessions/{id}", session.getId())
                                .header("Authorization", "Bearer " + other.token()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("EX-005"));
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

    @Test
    void listExerciseSessions_requiresAuthentication() throws Exception {
        mockMvc.perform(get("/exercise-sessions").param("patientProfileId", "1"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("G-003"));
    }

    @Test
    void getExerciseSessionDetail_requiresAuthentication() throws Exception {
        mockMvc.perform(get("/exercise-sessions/{id}", 1L))
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

    private ExerciseSession exerciseSession(
            PatientProfile patientProfile,
            int durationSec,
            double averageAccuracy,
            int completedMotionCount) {
        return ExerciseSession.builder()
                .patientProfile(patientProfile)
                .exerciseType(ExerciseType.TOP)
                .durationSec(durationSec)
                .averageAccuracy(averageAccuracy)
                .completedMotionCount(completedMotionCount)
                .build();
    }

    private ExerciseSessionMotion sessionMotion(
            ExerciseSession session, ExerciseMotion motion, int durationSec, double accuracy) {
        return ExerciseSessionMotion.builder()
                .session(session)
                .exerciseMotion(motion)
                .durationSec(durationSec)
                .accuracy(accuracy)
                .completedReps(8)
                .feedback("Good")
                .build();
    }

    private PatientProfile findProfile(TestUser user) {
        return patientProfileRepository.findById(user.patientProfileId()).orElseThrow();
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

    private String replayJson(int fps, int endMs, String reason) {
        return """
                {
                  "version": 1,
                  "fps": %d,
                  "durationMs": %d,
                  "landmarks": %s,
                  "frames": [
                    {"t": 0, "lm": %s},
                    {"t": %d, "lm": %s}
                  ],
                  "representativeSegment": {
                    "startMs": 0,
                    "endMs": %d,
                    "reason": "%s"
                  },
                  "markers": [
                    {
                      "startMs": 0,
                      "endMs": %d,
                      "reason": "%s"
                    }
                  ]
                }
                """
                .formatted(
                        fps,
                        endMs,
                        replayLandmarkNamesJson(),
                        replayFrameTuplesJson(),
                        endMs,
                        replayFrameTuplesJson(),
                        endMs,
                        reason,
                        endMs,
                        reason);
    }

    private String replayLandmarkNamesJson() {
        return """
                [
                  "LEFT_SHOULDER", "RIGHT_SHOULDER", "LEFT_ELBOW", "RIGHT_ELBOW",
                  "LEFT_WRIST", "RIGHT_WRIST", "LEFT_HIP", "RIGHT_HIP",
                  "LEFT_KNEE", "RIGHT_KNEE", "LEFT_ANKLE", "RIGHT_ANKLE"
                ]
                """;
    }

    private String replayFrameTuplesJson() {
        return """
                [
                  [0.1, 0.9, 0.0, 0.92],
                  [0.2, 0.9, 0.0, 0.92],
                  [0.1, 1.1, 0.0, 0.91],
                  [0.2, 1.1, 0.0, 0.91],
                  [0.1, 1.3, 0.0, 0.9],
                  [0.2, 1.3, 0.0, 0.9],
                  [0.1, 1.6, 0.0, 0.93],
                  [0.2, 1.6, 0.0, 0.93],
                  [0.1, 1.9, 0.0, 0.91],
                  [0.2, 1.9, 0.0, 0.91],
                  [0.1, 2.2, 0.0, 0.9],
                  [0.2, 2.2, 0.0, 0.9]
                ]
                """;
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
