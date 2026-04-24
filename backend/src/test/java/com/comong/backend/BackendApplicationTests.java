package com.comong.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.comong.backend.domain.patient.repository.PatientProfileRepository;
import com.comong.backend.domain.user.repository.UserRepository;

/**
 * 컨텍스트 로드 스모크 테스트.
 *
 * <p>test 프로파일은 DB 의존성을 제거한 경량 부팅을 목적으로 한다 (자세한 의도는 {@code
 * src/test/resources/application-test.yaml} 참고). 프로덕션에서 주입되는 Repository 들은 DB 없이 컨텍스트를 띄우기 위해 Mock
 * 으로 대체한다. 실제 DB 연동 테스트 인프라(Testcontainers 등)는 Epic 4 에서 별도 구축.
 */
@SpringBootTest
@ActiveProfiles("test")
class BackendApplicationTests {

    @MockitoBean private UserRepository userRepository;

    @MockitoBean private PatientProfileRepository patientProfileRepository;

    @Test
    void contextLoads() {}
}
