package com.comong.backend.domain.dialogue.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.comong.backend.domain.dialogue.repository.DialogueSessionRepository;
import com.comong.backend.domain.dialogue.repository.DialogueTurnRepository;
import com.comong.backend.domain.patient.repository.PatientProfileRepository;
import com.comong.backend.domain.user.repository.UserRepository;
import com.comong.backend.support.IntegrationTestSupport;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Dialogue 도메인 컨트롤러 통합 테스트. Testcontainers Postgres 위에서 실제 Flyway / JPA / Security 스택을 통과한다.
 *
 * <p>두 가지 NPC 흐름:
 *
 * <ul>
 *   <li>등대지기 (YEONGCHEOL) — BE 가 scene 생성·라우팅·closingLines 책임
 *   <li>마을 주민 6인 (JOEUN/DAIN/...) — FE 가 정적 스크립트 책임. BE 응답의 {@code scene} / {@code nextScene} /
 *       {@code closingLines} 가 모두 {@code null}, BE 는 turn raw 데이터 적재만 한다
 * </ul>
 */
@AutoConfigureMockMvc
class DialogueControllerIntegrationTest extends IntegrationTestSupport {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private DialogueTurnRepository dialogueTurnRepository;
    @Autowired private DialogueSessionRepository dialogueSessionRepository;
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
        dialogueTurnRepository.deleteAll();
        dialogueSessionRepository.deleteAll();
        patientProfileRepository.deleteAll();
        userRepository.deleteAll();
    }

    // ===== 등대지기 (BE-driven) — 세션 시작 =====

    @Test
    @DisplayName("등대지기 세션 시작 — 첫 장면에 mood 선택지 3개 + rest_today secondaryAction")
    void createSession_yeongcheol_returnsFirstSceneWithRestTodaySecondary() throws Exception {
        TestUser user = setupUserWithProfile("create-session@example.com", "create-session");

        mockMvc.perform(
                        post("/dialogue/sessions")
                                .header("Authorization", "Bearer " + user.token())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(startBody(user.patientProfileId(), "YEONGCHEOL")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value("SUCCESS"))
                .andExpect(jsonPath("$.data.sessionId").isNumber())
                .andExpect(jsonPath("$.data.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.data.scene.questionText").value("오늘 기분은 어떠니?"))
                .andExpect(jsonPath("$.data.scene.choices.length()").value(3))
                .andExpect(jsonPath("$.data.scene.choices[0].choiceIntentId").value("mood_okay"))
                .andExpect(
                        jsonPath("$.data.scene.secondaryAction.choiceIntentId").value("rest_today"))
                .andExpect(jsonPath("$.data.scene.shouldEndSession").value(false))
                .andExpect(jsonPath("$.data.scene.generatedBy").value("FALLBACK"));

        assertThat(dialogueSessionRepository.count()).isEqualTo(1);
    }

    // ===== 마을 주민 (FE-driven) — 세션 lifecycle =====

    @Test
    @DisplayName("마을 주민 세션 시작 — scene 필드 null (FE 가 자체 스크립트로 진행)")
    void createSession_villager_returnsNullScene() throws Exception {
        TestUser user = setupUserWithProfile("villager-create@example.com", "villager-create");

        mockMvc.perform(
                        post("/dialogue/sessions")
                                .header("Authorization", "Bearer " + user.token())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(startBody(user.patientProfileId(), "JOEUN")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value("SUCCESS"))
                .andExpect(jsonPath("$.data.sessionId").isNumber())
                .andExpect(jsonPath("$.data.status").value("IN_PROGRESS"))
                // scene 은 null → @JsonInclude(NON_NULL) 로 응답에서 omit
                .andExpect(jsonPath("$.data.scene").doesNotExist());

        assertThat(dialogueSessionRepository.count()).isEqualTo(1);
    }

    @Test
    @DisplayName("마을 주민 turn 제출 — raw 데이터 적재 + nextScene null (FE 자체 라우팅)")
    void submitTurn_villager_persistsTurnAndReturnsNullNextScene() throws Exception {
        TestUser user = setupUserWithProfile("villager-turn@example.com", "villager-turn");
        long sessionId = startSession(user, "JOEUN");

        mockMvc.perform(
                        post("/dialogue/sessions/{id}/turns", sessionId)
                                .header("Authorization", "Bearer " + user.token())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(turnBody("오늘 몸은 어떠니?", "hard_body", "몸이 힘들어요", 3)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.nextScene").doesNotExist());

        assertThat(dialogueTurnRepository.count()).isEqualTo(1);
        // FE 가 보낸 raw 데이터가 그대로 적재되었는지 generatedBy 로 확인 (NPC_SCRIPT)
    }

    @Test
    @DisplayName("마을 주민 finish — closingLines null (FE 가 자체 마무리 대사)")
    void finish_villager_returnsNullClosingLines() throws Exception {
        TestUser user = setupUserWithProfile("villager-finish@example.com", "villager-finish");
        long sessionId = startSession(user, "DAIN");

        mockMvc.perform(
                        post("/dialogue/sessions/{id}/finish", sessionId)
                                .header("Authorization", "Bearer " + user.token())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"finishReason\":\"COMPLETED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("FINISHED"))
                .andExpect(jsonPath("$.data.closingLines").doesNotExist());
    }

    @Test
    @DisplayName("마을 주민 세션 상세 조회 — turns 의 generatedBy 가 NPC_SCRIPT")
    void getDetail_villager_marksTurnsAsNpcScript() throws Exception {
        TestUser user = setupUserWithProfile("villager-detail@example.com", "villager-detail");
        long sessionId = startSession(user, "SEHYEON");
        submitTurn(user, sessionId, "무엇이 가장 걱정되니?", "worry_pain", "아픈 게 걱정돼요", 3);

        mockMvc.perform(
                        get("/dialogue/sessions/{id}", sessionId)
                                .header("Authorization", "Bearer " + user.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.npcName").value("SEHYEON"))
                .andExpect(jsonPath("$.data.turns.length()").value(1))
                .andExpect(jsonPath("$.data.turns[0].generatedBy").value("NPC_SCRIPT"));
    }

    // ===== 권한 / 인증 =====

    @Test
    @DisplayName("다른 사람 환자 프로필 ID 로 시작 시도 — 본인 소유 아님 → P-001 (404)")
    void createSession_foreignProfile_returnsNotFound() throws Exception {
        TestUser owner = setupUserWithProfile("owner@example.com", "owner-user");
        TestUser stranger = setupUserWithProfile("stranger@example.com", "stranger-user");

        mockMvc.perform(
                        post("/dialogue/sessions")
                                .header("Authorization", "Bearer " + stranger.token())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(startBody(owner.patientProfileId(), "YEONGCHEOL")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("P-001"));
    }

    @Test
    @DisplayName("Turn / Finish / Get / Create 모두 인증 필요")
    void allEndpoints_requireAuthentication() throws Exception {
        mockMvc.perform(
                        post("/dialogue/sessions")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(startBody(1L, "YEONGCHEOL")))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(
                        post("/dialogue/sessions/{id}/turns", 1L)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(turnBody("오늘 기분은 어떠니?", "mood_okay", "괜찮아요", 0)))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(
                        post("/dialogue/sessions/{id}/finish", 1L)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"finishReason\":\"COMPLETED\"}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/dialogue/sessions/{id}", 1L)).andExpect(status().isUnauthorized());
    }

    // ===== 등대지기 turn 처리 / 라우팅 =====

    @Test
    @DisplayName("mood_worried 선택 → worry_source 장면으로 라우팅")
    void submitTurn_moodWorried_routesToWorrySource() throws Exception {
        TestUser user = setupUserWithProfile("turn-worry@example.com", "turn-worry");
        long sessionId = startSession(user, "YEONGCHEOL");

        mockMvc.perform(
                        post("/dialogue/sessions/{id}/turns", sessionId)
                                .header("Authorization", "Bearer " + user.token())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(turnBody("오늘 기분은 어떠니?", "mood_worried", "걱정돼요", 2)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("SUCCESS"))
                .andExpect(jsonPath("$.data.nextScene.questionText").value("무엇이 가장 걱정되니?"))
                .andExpect(
                        jsonPath("$.data.nextScene.choices[0].choiceIntentId").value("worry_pain"))
                .andExpect(jsonPath("$.data.nextScene.secondaryAction").doesNotExist())
                .andExpect(jsonPath("$.data.nextScene.shouldEndSession").value(false));

        assertThat(dialogueTurnRepository.count()).isEqualTo(1);
    }

    @Test
    @DisplayName("action_breathe 선택 → 즉시 shouldEndSession=true (조기 종료)")
    void submitTurn_actionBreathe_endsSessionEarly() throws Exception {
        TestUser user = setupUserWithProfile("early-end@example.com", "early-end");
        long sessionId = startSession(user, "YEONGCHEOL");

        // step 0: mood_okay → action 화면으로 이동
        submitTurn(user, sessionId, "오늘 기분은 어떠니?", "mood_okay", "괜찮아요", 0);

        // step 1: action_breathe → 종료 신호
        mockMvc.perform(
                        post("/dialogue/sessions/{id}/turns", sessionId)
                                .header("Authorization", "Bearer " + user.token())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        turnBody(
                                                "지금 해볼 수 있는 작은 일은?",
                                                "action_breathe",
                                                "숨을 천천히 쉬어요",
                                                0)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.nextScene.shouldEndSession").value(true))
                .andExpect(jsonPath("$.data.nextScene.choices.length()").value(0));

        assertThat(dialogueTurnRepository.count()).isEqualTo(2);
    }

    @Test
    @DisplayName("maxSteps(=3) 도달 시 다음 scene 은 shouldEndSession=true")
    void submitTurn_maxStepsReached_endsSession() throws Exception {
        TestUser user = setupUserWithProfile("max-steps@example.com", "max-steps");
        long sessionId = startSession(user, "YEONGCHEOL");

        submitTurn(user, sessionId, "오늘 기분은 어떠니?", "mood_worried", "걱정돼요", 2); // step 0
        submitTurn(user, sessionId, "무엇이 가장 걱정되니?", "worry_pain", "아픈 게 걱정돼요", 3); // step 1

        // step 2: 어느 선택이든 maxSteps=3 도달로 종료
        mockMvc.perform(
                        post("/dialogue/sessions/{id}/turns", sessionId)
                                .header("Authorization", "Bearer " + user.token())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        turnBody(
                                                "어떻게 도움을 받아볼까?",
                                                "support_medical",
                                                "선생님께 말할래요",
                                                0)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.nextScene.shouldEndSession").value(true));

        assertThat(dialogueTurnRepository.count()).isEqualTo(3);
    }

    @Test
    @DisplayName("이미 종료된 세션에 turn 제출 — DL-003 (409)")
    void submitTurn_alreadyFinished_returnsConflict() throws Exception {
        TestUser user = setupUserWithProfile("after-finish@example.com", "after-finish");
        long sessionId = startSession(user, "YEONGCHEOL");
        finishSession(user, sessionId, "COMPLETED");

        mockMvc.perform(
                        post("/dialogue/sessions/{id}/turns", sessionId)
                                .header("Authorization", "Bearer " + user.token())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(turnBody("오늘 기분은 어떠니?", "mood_okay", "괜찮아요", 0)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DL-003"));
    }

    @Test
    @DisplayName("다른 사람 세션에 turn 제출 — DL-001 (404, enumeration 방지)")
    void submitTurn_foreignSession_returnsNotFound() throws Exception {
        TestUser owner = setupUserWithProfile("turn-owner@example.com", "turn-owner");
        TestUser stranger = setupUserWithProfile("turn-stranger@example.com", "turn-stranger");
        long ownerSessionId = startSession(owner, "YEONGCHEOL");

        mockMvc.perform(
                        post("/dialogue/sessions/{id}/turns", ownerSessionId)
                                .header("Authorization", "Bearer " + stranger.token())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(turnBody("오늘 기분은 어떠니?", "mood_okay", "괜찮아요", 0)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("DL-001"));
    }

    // ===== 등대지기 종료 =====

    @Test
    @DisplayName("등대지기 종료 — closingLines 만 반환, 마음엽서/분석 결과 없음")
    void finish_yeongcheol_returnsClosingLinesOnly() throws Exception {
        TestUser user = setupUserWithProfile("finish@example.com", "finish-user");
        long sessionId = startSession(user, "YEONGCHEOL");

        mockMvc.perform(
                        post("/dialogue/sessions/{id}/finish", sessionId)
                                .header("Authorization", "Bearer " + user.token())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"finishReason\":\"COMPLETED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.sessionId").value(sessionId))
                .andExpect(jsonPath("$.data.status").value("FINISHED"))
                .andExpect(jsonPath("$.data.closingLines.length()").value(2))
                .andExpect(jsonPath("$.data.closingLines[0]").value("오늘 말해줘서 고맙구나."))
                .andExpect(jsonPath("$.data.caregiverFacingNote").doesNotExist());
    }

    @Test
    @DisplayName("등대지기 REST_TODAY 종료는 다른 closingLines 사용")
    void finish_yeongcheol_restToday_usesRestClosingLines() throws Exception {
        TestUser user = setupUserWithProfile("rest@example.com", "rest-user");
        long sessionId = startSession(user, "YEONGCHEOL");

        mockMvc.perform(
                        post("/dialogue/sessions/{id}/finish", sessionId)
                                .header("Authorization", "Bearer " + user.token())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"finishReason\":\"REST_TODAY\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.closingLines[0]").value("알겠다. 오늘은 쉬어도 괜찮단다."));
    }

    @Test
    @DisplayName("이미 종료된 세션 다시 종료 — DL-003 (409)")
    void finish_alreadyFinished_returnsConflict() throws Exception {
        TestUser user = setupUserWithProfile("double-finish@example.com", "double-finish");
        long sessionId = startSession(user, "YEONGCHEOL");
        finishSession(user, sessionId, "COMPLETED");

        mockMvc.perform(
                        post("/dialogue/sessions/{id}/finish", sessionId)
                                .header("Authorization", "Bearer " + user.token())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"finishReason\":\"COMPLETED\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DL-003"));
    }

    // ===== 상세 조회 =====

    @Test
    @DisplayName("등대지기 세션 상세 조회 — 메타 + 모든 턴 stepIndex 오름차순 + generatedBy=FALLBACK")
    void getDetail_yeongcheol_returnsSessionAndTurnsOrdered() throws Exception {
        TestUser user = setupUserWithProfile("detail@example.com", "detail-user");
        long sessionId = startSession(user, "YEONGCHEOL");
        submitTurn(user, sessionId, "오늘 기분은 어떠니?", "mood_worried", "걱정돼요", 2);
        submitTurn(user, sessionId, "무엇이 가장 걱정되니?", "worry_pain", "아픈 게 걱정돼요", 3);
        finishSession(user, sessionId, "COMPLETED");

        mockMvc.perform(
                        get("/dialogue/sessions/{id}", sessionId)
                                .header("Authorization", "Bearer " + user.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.sessionId").value(sessionId))
                .andExpect(jsonPath("$.data.npcName").value("YEONGCHEOL"))
                .andExpect(jsonPath("$.data.status").value("FINISHED"))
                .andExpect(jsonPath("$.data.finishReason").value("COMPLETED"))
                .andExpect(jsonPath("$.data.stepCount").value(2))
                .andExpect(jsonPath("$.data.turns.length()").value(2))
                .andExpect(jsonPath("$.data.turns[0].stepIndex").value(0))
                .andExpect(jsonPath("$.data.turns[0].choiceIntentId").value("mood_worried"))
                .andExpect(jsonPath("$.data.turns[0].generatedBy").value("FALLBACK"))
                .andExpect(jsonPath("$.data.turns[1].stepIndex").value(1))
                .andExpect(jsonPath("$.data.turns[1].choiceIntentId").value("worry_pain"));
    }

    // ===== helpers =====

    private long startSession(TestUser user, String npcName) throws Exception {
        String body =
                mockMvc.perform(
                                post("/dialogue/sessions")
                                        .header("Authorization", "Bearer " + user.token())
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(startBody(user.patientProfileId(), npcName)))
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        return objectMapper.readTree(body).get("data").get("sessionId").asLong();
    }

    private void submitTurn(
            TestUser user,
            long sessionId,
            String questionText,
            String choiceIntentId,
            String text,
            int intensity)
            throws Exception {
        mockMvc.perform(
                        post("/dialogue/sessions/{id}/turns", sessionId)
                                .header("Authorization", "Bearer " + user.token())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(turnBody(questionText, choiceIntentId, text, intensity)))
                .andExpect(status().isOk());
    }

    private void finishSession(TestUser user, long sessionId, String finishReason)
            throws Exception {
        mockMvc.perform(
                        post("/dialogue/sessions/{id}/finish", sessionId)
                                .header("Authorization", "Bearer " + user.token())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"finishReason\":\"" + finishReason + "\"}"))
                .andExpect(status().isOk());
    }

    private String startBody(Long patientProfileId, String npcName) {
        return """
                {
                  "patientProfileId": %d,
                  "npcName": "%s"
                }
                """
                .formatted(patientProfileId, npcName);
    }

    private String turnBody(
            String questionText, String choiceIntentId, String text, int intensity) {
        return """
                {
                  "questionText": "%s",
                  "selectedChoice": {
                    "choiceIntentId": "%s",
                    "text": "%s",
                    "intensity": %d,
                    "concernFlags": [],
                    "protectiveFactors": []
                  }
                }
                """
                .formatted(questionText, choiceIntentId, text, intensity);
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
