package com.comong.backend.support;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * 통합 테스트 베이스. Testcontainers Postgres 컨테이너를 테스트 JVM에서 한 번 띄워 모든 하위 테스트가 공유한다.
 *
 * <p>여러 Spring 테스트 클래스가 같은 ApplicationContext를 안전하게 재사용할 수 있도록 datasource 접속 정보는
 * DynamicPropertySource로 주입한다.
 *
 * <p>JUnit이 클래스 단위로 {@code @Container} 생명주기를 관리하면 Spring context cache가 이미 종료된 datasource를 재사용할 수
 * 있어, 컨테이너를 테스트 JVM 생명주기에 맞춰 직접 시작한다.
 */
@SpringBootTest
@ActiveProfiles("test")
public abstract class IntegrationTestSupport {

    private static final PostgreSQLContainer POSTGRES =
            new PostgreSQLContainer("postgres:16-alpine");

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }
}
