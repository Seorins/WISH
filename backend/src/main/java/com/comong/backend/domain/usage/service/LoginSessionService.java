package com.comong.backend.domain.usage.service;

import java.time.LocalDateTime;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.comong.backend.domain.patient.entity.PatientProfile;
import com.comong.backend.domain.patient.service.PatientProfileService;
import com.comong.backend.domain.usage.dto.LoginSessionResponse;
import com.comong.backend.domain.usage.entity.LoginSession;
import com.comong.backend.domain.usage.exception.UsageErrorCode;
import com.comong.backend.domain.usage.repository.LoginSessionRepository;
import com.comong.backend.global.exception.BusinessException;

import lombok.RequiredArgsConstructor;

/**
 * 접속 세션 라이프사이클 (시작/heartbeat/종료) 유스케이스.
 *
 * <p>모든 호출은 인증된 보호자(user) 기준 — patient 소유 검증 후 진행한다. 세션 조회 실패는 enumeration 방지로 ID 존재/비존재를 구분하지 않고
 * {@link UsageErrorCode#LOGIN_SESSION_NOT_FOUND} 로 통합한다 (PatientProfileService 와 동일 패턴).
 *
 * <p>현재 시각은 서버의 {@code LocalDateTime.now()} 를 사용 — 클라이언트가 보낸 시각은 신뢰하지 않는다 (시계 변조/시차).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class LoginSessionService {

    private final LoginSessionRepository loginSessionRepository;
    private final PatientProfileService patientProfileService;

    @Transactional
    public LoginSessionResponse start(Long userId, Long patientProfileId) {
        PatientProfile patientProfile =
                patientProfileService.findOwnedOrThrow(userId, patientProfileId);
        LoginSession saved =
                loginSessionRepository.save(
                        LoginSession.builder()
                                .patientProfile(patientProfile)
                                .startedAt(LocalDateTime.now())
                                .build());
        return LoginSessionResponse.from(saved);
    }

    @Transactional
    public LoginSessionResponse heartbeat(Long userId, Long sessionId) {
        LoginSession session = findOwnedOrThrow(userId, sessionId);
        session.heartbeat(LocalDateTime.now());
        return LoginSessionResponse.from(session);
    }

    @Transactional
    public LoginSessionResponse end(Long userId, Long sessionId) {
        LoginSession session = findOwnedOrThrow(userId, sessionId);
        session.end(LocalDateTime.now());
        return LoginSessionResponse.from(session);
    }

    private LoginSession findOwnedOrThrow(Long userId, Long sessionId) {
        return loginSessionRepository
                .findByIdWithPatientAndUser(sessionId)
                .filter(s -> s.isOwnedBy(userId))
                .orElseThrow(() -> new BusinessException(UsageErrorCode.LOGIN_SESSION_NOT_FOUND));
    }
}
