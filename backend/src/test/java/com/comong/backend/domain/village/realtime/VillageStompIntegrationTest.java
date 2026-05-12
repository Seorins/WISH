package com.comong.backend.domain.village.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.lang.reflect.Type;
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

import com.comong.backend.domain.user.entity.UserRole;
import com.comong.backend.global.security.JwtTokenProvider;
import com.comong.backend.support.IntegrationTestSupport;

/**
 * S14P31E103-714 STOMP 인프라 라운드트립 검증.
 *
 * <p>app.realtime.village.enabled 가 기본 false 라 통합 테스트에서는 true 로 override 한다 (운영 폴백 기본값 유지 + 테스트는 정상
 * 경로 검증).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = "app.realtime.village.enabled=true")
class VillageStompIntegrationTest extends IntegrationTestSupport {

    private static final String CONTEXT_PATH = "/api/v1";
    private static final long CONNECT_TIMEOUT_SECONDS = 5;
    private static final long RECEIVE_TIMEOUT_SECONDS = 5;

    @LocalServerPort private int port;
    @Autowired private JwtTokenProvider jwtTokenProvider;

    private WebSocketStompClient stompClient;

    @BeforeEach
    void setUp() {
        stompClient = new WebSocketStompClient(new StandardWebSocketClient());
        stompClient.setMessageConverter(new StringMessageConverter());
    }

    @AfterEach
    void tearDown() {
        if (stompClient != null) {
            stompClient.stop();
        }
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
    void pingEchoesUserIdWhenAuthenticated() throws Exception {
        String token = jwtTokenProvider.createAccessToken(42L, "tester@example.com", UserRole.USER);
        StompHeaders connectHeaders = new StompHeaders();
        connectHeaders.add("Authorization", "Bearer " + token);

        StompSession session = connect(connectHeaders);

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
        assertThat(pong).isEqualTo("pong:42:hello");

        session.disconnect();
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
