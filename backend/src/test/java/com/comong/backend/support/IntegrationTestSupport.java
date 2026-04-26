package com.comong.backend.support;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * 통합 테스트 베이스. Testcontainers Postgres 컨테이너를 한 번 띄워 모든 하위 테스트가 공유한다.
 *
 * <p>{@code @ServiceConnection} 이 datasource URL/계정을 자동 주입하므로 application-test.yaml 에는 접속 정보를 적지
 * 않는다. Flyway 가 V1.. 마이그레이션을 적용하고 JPA ddl-auto=validate 가 엔티티 매핑 정합성을 검증한다.
 */
@SpringBootTest
@ActiveProfiles("test")
@Testcontainers
public abstract class IntegrationTestSupport {

    @Container @ServiceConnection
    protected static final PostgreSQLContainer POSTGRES =
            new PostgreSQLContainer("postgres:16-alpine");
}
