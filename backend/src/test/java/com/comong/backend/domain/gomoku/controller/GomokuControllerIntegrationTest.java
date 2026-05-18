package com.comong.backend.domain.gomoku.controller;

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

import com.comong.backend.domain.gomoku.repository.GomokuMatchRepository;
import com.comong.backend.domain.patient.repository.PatientProfileRepository;
import com.comong.backend.domain.user.repository.UserRepository;
import com.comong.backend.support.IntegrationTestSupport;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@AutoConfigureMockMvc
class GomokuControllerIntegrationTest extends IntegrationTestSupport {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private GomokuMatchRepository gomokuMatchRepository;
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
        gomokuMatchRepository.deleteAll();
        patientProfileRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void onlineMatchWin_isRecordedInStatsAndRanking() throws Exception {
        TestUser black = setupUserWithProfile("gomoku-black@example.com", "gomoku-black", "black");
        TestUser white = setupUserWithProfile("gomoku-white@example.com", "gomoku-white", "white");

        long roomId =
                objectMapper
                        .readTree(
                                mockMvc.perform(
                                                post("/gomoku/rooms")
                                                        .header(
                                                                "Authorization",
                                                                "Bearer " + black.token())
                                                        .contentType(MediaType.APPLICATION_JSON)
                                                        .content(createRoomRequest()))
                                        .andExpect(status().isCreated())
                                        .andExpect(jsonPath("$.data.status").value("WAITING"))
                                        .andExpect(jsonPath("$.data.myStone").value("BLACK"))
                                        .andReturn()
                                        .getResponse()
                                        .getContentAsString())
                        .get("data")
                        .get("id")
                        .asLong();

        mockMvc.perform(
                        get("/gomoku/rooms/waiting")
                                .header("Authorization", "Bearer " + white.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].id").value(roomId));

        mockMvc.perform(
                        post("/gomoku/rooms/{roomId}/join", roomId)
                                .header("Authorization", "Bearer " + white.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PLAYING"))
                .andExpect(jsonPath("$.data.myStone").value("WHITE"));

        play(black.token(), roomId, 7, 7).andExpect(jsonPath("$.data.status").value("PLAYING"));
        play(white.token(), roomId, 0, 0).andExpect(jsonPath("$.data.status").value("PLAYING"));
        play(black.token(), roomId, 7, 8).andExpect(jsonPath("$.data.status").value("PLAYING"));
        play(white.token(), roomId, 0, 1).andExpect(jsonPath("$.data.status").value("PLAYING"));
        play(black.token(), roomId, 7, 9).andExpect(jsonPath("$.data.status").value("PLAYING"));
        play(white.token(), roomId, 0, 2).andExpect(jsonPath("$.data.status").value("PLAYING"));
        play(black.token(), roomId, 7, 10).andExpect(jsonPath("$.data.status").value("PLAYING"));
        play(white.token(), roomId, 0, 3).andExpect(jsonPath("$.data.status").value("PLAYING"));
        play(black.token(), roomId, 7, 11)
                .andExpect(jsonPath("$.data.status").value("FINISHED"))
                .andExpect(jsonPath("$.data.result").value("BLACK_WIN"))
                .andExpect(jsonPath("$.data.endReason").value("FIVE"))
                .andExpect(jsonPath("$.data.ranked").value(true))
                .andExpect(jsonPath("$.data.moveCount").value(9));

        mockMvc.perform(get("/gomoku/stats/me").header("Authorization", "Bearer " + black.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalGames").value(1))
                .andExpect(jsonPath("$.data.wins").value(1))
                .andExpect(jsonPath("$.data.losses").value(0))
                .andExpect(jsonPath("$.data.winRate").value(1.0));

        mockMvc.perform(get("/gomoku/stats/me").header("Authorization", "Bearer " + white.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalGames").value(1))
                .andExpect(jsonPath("$.data.wins").value(0))
                .andExpect(jsonPath("$.data.losses").value(1))
                .andExpect(jsonPath("$.data.winRate").value(0.0));

        mockMvc.perform(
                        get("/gomoku/ranking")
                                .param("limit", "10")
                                .param("minGames", "1")
                                .header("Authorization", "Bearer " + black.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalPlayers").value(2))
                .andExpect(jsonPath("$.data.entries[0].nickname").value("black"))
                .andExpect(jsonPath("$.data.entries[0].wins").value(1))
                .andExpect(jsonPath("$.data.entries[0].isMe").value(true));
    }

    @Test
    void roomResponses_includePlayerTextureKeys() throws Exception {
        TestUser black =
                setupUserWithProfile("gomoku-texture-black@example.com", "texture-black", "black");
        TestUser white =
                setupUserWithProfile("gomoku-texture-white@example.com", "texture-white", "white");

        long roomId =
                objectMapper
                        .readTree(
                                mockMvc.perform(
                                                post("/gomoku/rooms")
                                                        .header(
                                                                "Authorization",
                                                                "Bearer " + black.token())
                                                        .contentType(MediaType.APPLICATION_JSON)
                                                        .content(
                                                                createRoomRequest(
                                                                        "FREESTYLE",
                                                                        "character-outfit-man3")))
                                        .andExpect(status().isCreated())
                                        .andExpect(
                                                jsonPath("$.data.blackPlayer.textureKey")
                                                        .value("character-outfit-man3"))
                                        .andReturn()
                                        .getResponse()
                                        .getContentAsString())
                        .get("data")
                        .get("id")
                        .asLong();

        mockMvc.perform(
                        post("/gomoku/rooms/{roomId}/join", roomId)
                                .header("Authorization", "Bearer " + white.token())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(joinRoomRequest("character-outfit-girl4")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.blackPlayer.textureKey").value("character-outfit-man3"))
                .andExpect(
                        jsonPath("$.data.whitePlayer.textureKey").value("character-outfit-girl4"));

        mockMvc.perform(
                        get("/gomoku/rooms/{roomId}", roomId)
                                .header("Authorization", "Bearer " + black.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.blackPlayer.textureKey").value("character-outfit-man3"))
                .andExpect(
                        jsonPath("$.data.whitePlayer.textureKey").value("character-outfit-girl4"));
    }

    @Test
    void joinRoom_rejectsSelfPlay() throws Exception {
        TestUser user = setupUserWithProfile("gomoku-self@example.com", "gomoku-self", "self");
        long roomId =
                objectMapper
                        .readTree(
                                mockMvc.perform(
                                                post("/gomoku/rooms")
                                                        .header(
                                                                "Authorization",
                                                                "Bearer " + user.token())
                                                        .contentType(MediaType.APPLICATION_JSON)
                                                        .content(createRoomRequest()))
                                        .andExpect(status().isCreated())
                                        .andReturn()
                                        .getResponse()
                                        .getContentAsString())
                        .get("data")
                        .get("id")
                        .asLong();

        mockMvc.perform(
                        post("/gomoku/rooms/{roomId}/join", roomId)
                                .header("Authorization", "Bearer " + user.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("GM-007"));
    }

    @Test
    void ranking_ordersByWinsBeforeWinRate() throws Exception {
        TestUser alpha =
                setupUserWithProfile("gomoku-rank-alpha@example.com", "rank-alpha", "alpha");
        TestUser beta = setupUserWithProfile("gomoku-rank-beta@example.com", "rank-beta", "beta");
        TestUser gamma =
                setupUserWithProfile("gomoku-rank-gamma@example.com", "rank-gamma", "gamma");

        finishBlackWin(alpha, gamma);
        finishBlackWin(alpha, gamma);
        finishBlackWin(gamma, alpha);
        finishBlackWin(beta, gamma);

        mockMvc.perform(
                        get("/gomoku/ranking")
                                .param("limit", "10")
                                .param("minGames", "1")
                                .header("Authorization", "Bearer " + alpha.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalPlayers").value(3))
                .andExpect(jsonPath("$.data.entries[0].nickname").value("alpha"))
                .andExpect(jsonPath("$.data.entries[0].wins").value(2))
                .andExpect(jsonPath("$.data.entries[1].nickname").value("beta"))
                .andExpect(jsonPath("$.data.entries[1].wins").value(1));
    }

    @Test
    void renjuLite_rejectsBrokenDoubleThreeMove() throws Exception {
        TestUser black =
                setupUserWithProfile(
                        "gomoku-renju-black@example.com", "gomoku-renju-black", "renju-black");
        TestUser white =
                setupUserWithProfile(
                        "gomoku-renju-white@example.com", "gomoku-renju-white", "renju-white");

        long roomId =
                objectMapper
                        .readTree(
                                mockMvc.perform(
                                                post("/gomoku/rooms")
                                                        .header(
                                                                "Authorization",
                                                                "Bearer " + black.token())
                                                        .contentType(MediaType.APPLICATION_JSON)
                                                        .content(createRoomRequest("RENJU_LITE")))
                                        .andExpect(status().isCreated())
                                        .andReturn()
                                        .getResponse()
                                        .getContentAsString())
                        .get("data")
                        .get("id")
                        .asLong();

        mockMvc.perform(
                        post("/gomoku/rooms/{roomId}/join", roomId)
                                .header("Authorization", "Bearer " + white.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PLAYING"));

        play(black.token(), roomId, 7, 6);
        play(white.token(), roomId, 0, 0);
        play(black.token(), roomId, 7, 9);
        play(white.token(), roomId, 0, 1);
        play(black.token(), roomId, 6, 7);
        play(white.token(), roomId, 0, 2);
        play(black.token(), roomId, 9, 7);
        play(white.token(), roomId, 0, 3);

        attemptPlay(black.token(), roomId, 7, 7)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("GM-005"));
    }

    @Test
    void renjuLite_allowsBlackFourThreeMove() throws Exception {
        TestUser black =
                setupUserWithProfile(
                        "gomoku-four-three-black@example.com",
                        "gomoku-four-three-black",
                        "four-three-black");
        TestUser white =
                setupUserWithProfile(
                        "gomoku-four-three-white@example.com",
                        "gomoku-four-three-white",
                        "four-three-white");

        long roomId =
                objectMapper
                        .readTree(
                                mockMvc.perform(
                                                post("/gomoku/rooms")
                                                        .header(
                                                                "Authorization",
                                                                "Bearer " + black.token())
                                                        .contentType(MediaType.APPLICATION_JSON)
                                                        .content(createRoomRequest("RENJU_LITE")))
                                        .andExpect(status().isCreated())
                                        .andReturn()
                                        .getResponse()
                                        .getContentAsString())
                        .get("data")
                        .get("id")
                        .asLong();

        mockMvc.perform(
                        post("/gomoku/rooms/{roomId}/join", roomId)
                                .header("Authorization", "Bearer " + white.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PLAYING"));

        play(black.token(), roomId, 7, 5);
        play(white.token(), roomId, 0, 0);
        play(black.token(), roomId, 7, 6);
        play(white.token(), roomId, 0, 2);
        play(black.token(), roomId, 7, 8);
        play(white.token(), roomId, 0, 4);
        play(black.token(), roomId, 6, 7);
        play(white.token(), roomId, 1, 0);
        play(black.token(), roomId, 8, 7);
        play(white.token(), roomId, 1, 2);

        play(black.token(), roomId, 7, 7)
                .andExpect(jsonPath("$.data.status").value("PLAYING"))
                .andExpect(jsonPath("$.data.moveCount").value(11));
    }

    @Test
    void renjuLite_allowsBlackBrokenDiagonalFourThreeMove() throws Exception {
        TestUser black =
                setupUserWithProfile(
                        "gomoku-broken-four-three-black@example.com",
                        "gomoku-broken-four-three-black",
                        "broken-four-three-black");
        TestUser white =
                setupUserWithProfile(
                        "gomoku-broken-four-three-white@example.com",
                        "gomoku-broken-four-three-white",
                        "broken-four-three-white");

        long roomId = createJoinedRoom(black, white, "RENJU_LITE");

        play(black.token(), roomId, 4, 4);
        play(white.token(), roomId, 0, 0);
        play(black.token(), roomId, 5, 5);
        play(white.token(), roomId, 0, 2);
        play(black.token(), roomId, 8, 8);
        play(white.token(), roomId, 0, 4);
        play(black.token(), roomId, 7, 5);
        play(white.token(), roomId, 1, 0);
        play(black.token(), roomId, 7, 6);
        play(white.token(), roomId, 1, 2);

        play(black.token(), roomId, 7, 7)
                .andExpect(jsonPath("$.data.status").value("PLAYING"))
                .andExpect(jsonPath("$.data.moveCount").value(11));
    }

    private void finishBlackWin(TestUser black, TestUser white) throws Exception {
        long roomId = createJoinedRoom(black, white, "FREESTYLE");
        play(black.token(), roomId, 7, 7);
        play(white.token(), roomId, 0, 0);
        play(black.token(), roomId, 7, 8);
        play(white.token(), roomId, 0, 1);
        play(black.token(), roomId, 7, 9);
        play(white.token(), roomId, 0, 2);
        play(black.token(), roomId, 7, 10);
        play(white.token(), roomId, 0, 3);
        play(black.token(), roomId, 7, 11).andExpect(jsonPath("$.data.status").value("FINISHED"));
    }

    private long createJoinedRoom(TestUser black, TestUser white, String ruleSet) throws Exception {
        long roomId =
                objectMapper
                        .readTree(
                                mockMvc.perform(
                                                post("/gomoku/rooms")
                                                        .header(
                                                                "Authorization",
                                                                "Bearer " + black.token())
                                                        .contentType(MediaType.APPLICATION_JSON)
                                                        .content(createRoomRequest(ruleSet)))
                                        .andExpect(status().isCreated())
                                        .andReturn()
                                        .getResponse()
                                        .getContentAsString())
                        .get("data")
                        .get("id")
                        .asLong();

        mockMvc.perform(
                        post("/gomoku/rooms/{roomId}/join", roomId)
                                .header("Authorization", "Bearer " + white.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PLAYING"));
        return roomId;
    }

    private org.springframework.test.web.servlet.ResultActions play(
            String token, long roomId, int row, int col) throws Exception {
        return attemptPlay(token, roomId, row, col).andExpect(status().isOk());
    }

    private org.springframework.test.web.servlet.ResultActions attemptPlay(
            String token, long roomId, int row, int col) throws Exception {
        return mockMvc.perform(
                post("/gomoku/rooms/{roomId}/moves", roomId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"row\":" + row + ",\"col\":" + col + "}"));
    }

    private TestUser setupUserWithProfile(String email, String nickname, String patientNickname)
            throws Exception {
        String token = setupUser(email, nickname);
        String body =
                mockMvc.perform(
                                post("/patient-profiles")
                                        .header("Authorization", "Bearer " + token)
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"name\":\"Patient\",\"nickname\":\""
                                                        + patientNickname
                                                        + "\",\"birthDate\":\"2020-01-01\","
                                                        + "\"gender\":\"MALE\"}"))
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        JsonNode profile = objectMapper.readTree(body).get("data");
        return new TestUser(token, profile.get("id").asLong());
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

    private String createRoomRequest() {
        return createRoomRequest("FREESTYLE");
    }

    private String createRoomRequest(String ruleSet) {
        return "{\"ruleSet\":\"" + ruleSet + "\",\"timerSeconds\":300}";
    }

    private String createRoomRequest(String ruleSet, String textureKey) {
        return "{\"ruleSet\":\""
                + ruleSet
                + "\",\"timerSeconds\":300,\"textureKey\":\""
                + textureKey
                + "\"}";
    }

    private String joinRoomRequest(String textureKey) {
        return "{\"textureKey\":\"" + textureKey + "\"}";
    }

    private record TestUser(String token, Long patientProfileId) {}
}
