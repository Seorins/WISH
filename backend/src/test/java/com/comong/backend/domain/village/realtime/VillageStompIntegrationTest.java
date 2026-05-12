package com.comong.backend.domain.village.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.lang.reflect.Type;
import java.time.LocalDate;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.messaging.converter.StringMessageConverter;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.test.context.TestPropertySource;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

import com.comong.backend.domain.patient.entity.Gender;
import com.comong.backend.domain.patient.entity.PatientProfile;
import com.comong.backend.domain.patient.repository.PatientProfileRepository;
import com.comong.backend.domain.user.entity.User;
import com.comong.backend.domain.user.entity.UserRole;
import com.comong.backend.domain.user.repository.UserRepository;
import com.comong.backend.domain.village.realtime.service.VillagePresenceService;
import com.comong.backend.global.security.JwtTokenProvider;
import com.comong.backend.support.IntegrationTestSupport;

/**
 * S14P31E103-714 STOMP 인프라 라운드트립 검증.
 *
 * <p>app.realtime.village.enabled 가 기본 false 라 통합 테스트에서는 true 로 override 한다 (운영 폴백 기본값 유지 + 테스트는 정상
 * 경로 검증). S14P31E103-717 이후 presence 인터셉터가 추가되어 입장 시 PatientProfile 이 필요하므로 setUp 에서 미리 만들어둔다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = "app.realtime.village.enabled=true")
class VillageStompIntegrationTest extends IntegrationTestSupport {

    private static final String CONTEXT_PATH = "/api/v1";
    private static final long CONNECT_TIMEOUT_SECONDS = 5;
    private static final long RECEIVE_TIMEOUT_SECONDS = 5;

    @LocalServerPort private int port;
    @Autowired private JwtTokenProvider jwtTokenProvider;
    @Autowired private UserRepository userRepository;
    @Autowired private PatientProfileRepository patientProfileRepository;
    @Autowired private VillagePresenceService presenceService;

    private WebSocketStompClient stompClient;
    private User user;

    @BeforeEach
    void setUp() {
        patientProfileRepository.deleteAll();
        userRepository.deleteAll();

        user =
                userRepository.save(
                        User.builder()
                                .email("village-tester@example.com")
                                .nickname("guardian")
                                .password("encoded-password")
                                .role(UserRole.USER)
                                .build());
        patientProfileRepository.save(
                PatientProfile.builder()
                        .user(user)
                        .name("꼬마")
                        .nickname("꼬마곰")
                        .birthDate(LocalDate.of(2020, 1, 1))
                        .gender(Gender.MALE)
                        .build());

        stompClient = new WebSocketStompClient(new StandardWebSocketClient());
        stompClient.setMessageConverter(new StringMessageConverter());
    }

    @AfterEach
    void tearDown() {
        if (stompClient != null) {
            stompClient.stop();
        }
        patientProfileRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void connectIsRejectedWhenAuthorizationHeaderMissing() {
        assertThatThrownBy(() -> connect(new StompHeaders()))
                .isInstanceOf(ExecutionException.class);
    }

    @Test
    void connectIsRejectedWhenJwtIsInvalid() {
        StompHeaders headers = new StompHeaders();
        headers.add("Authorization", "Bearer not-a-real-jwt");

        assertThatThrownBy(() -> connect(headers)).isInstanceOf(ExecutionException.class);
    }

    @Test
    void connectIsRejectedWhenUserHasNoPatientProfile() {
        // S14P31E103-717: presence 인터셉터가 PatientProfile 부재를 거부 사유로 본다.
        patientProfileRepository.deleteAll();

        String token =
                jwtTokenProvider.createAccessToken(user.getId(), user.getEmail(), UserRole.USER);
        StompHeaders headers = new StompHeaders();
        headers.add("Authorization", "Bearer " + token);

        assertThatThrownBy(() -> connect(headers)).isInstanceOf(ExecutionException.class);
        assertThat(presenceService.size()).isZero();
    }

    @Test
    void disconnectRemovesPresence() throws Exception {
        // S14P31E103-717: SessionDisconnectListener 가 presence 에서 즉시 제거하는지 라운드트립 검증.
        StompSession session = connectAsUser();
        waitUntilPresenceSizeEquals(1);

        session.disconnect();
        waitUntilPresenceSizeEquals(0);
    }

    @Test
    void pingEchoesUserIdWhenAuthenticated() throws Exception {
        StompSession session = connectAsUser();

        LinkedBlockingQueue<String> received = new LinkedBlockingQueue<>();
        session.subscribe(
                "/user/queue/village.pong",
                new StompFrameHandler() {
                    @Override
                    public Type getPayloadType(StompHeaders headers) {
                        return String.class;
                    }

                    @Override
                    public void handleFrame(StompHeaders headers, Object payload) {
                        received.add((String) payload);
                    }
                });

        // SimpleBroker 는 SUBSCRIBE 에 RECEIPT 를 보내지 않아 등록 확정 신호가 없다. 동일 JVM 환경이므로 짧은
        // sleep 으로 충분 — CI 환경 변동성 고려해 200ms.
        Thread.sleep(200);
        session.send("/app/village/ping", "hello");

        String pong = received.poll(RECEIVE_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        assertThat(pong).isNotNull();
        assertThat(pong).isEqualTo("pong:" + user.getId() + ":hello");

        session.disconnect();
    }

    private StompSession connectAsUser() throws Exception {
        String token =
                jwtTokenProvider.createAccessToken(user.getId(), user.getEmail(), UserRole.USER);
        StompHeaders headers = new StompHeaders();
        headers.add("Authorization", "Bearer " + token);
        return connect(headers);
    }

    /** presence 갱신은 SessionDisconnectEvent 가 메시지 채널을 통해 비동기 전달되므로 즉시 보장되지 않는다. 짧은 폴링으로 결정적 검증. */
    private void waitUntilPresenceSizeEquals(int expected) throws InterruptedException {
        long deadline = System.currentTimeMillis() + 3_000L;
        while (presenceService.size() != expected && System.currentTimeMillis() < deadline) {
            Thread.sleep(50);
        }
        assertThat(presenceService.size()).isEqualTo(expected);
    }

    private StompSession connect(StompHeaders connectHeaders) throws Exception {
        return stompClient
                .connectAsync(
                        "ws://localhost:" + port + CONTEXT_PATH + "/ws/village",
                        new WebSocketHttpHeaders(),
                        connectHeaders,
                        new StompSessionHandlerAdapter() {})
                .get(CONNECT_TIMEOUT_SECONDS, TimeUnit.SECONDS);
    }
}
