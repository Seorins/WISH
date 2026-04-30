package com.comong.backend.domain.auth.service;

import java.time.LocalDate;
import java.util.UUID;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.comong.backend.domain.auth.dto.TokenResponse;
import com.comong.backend.domain.patient.entity.Gender;
import com.comong.backend.domain.patient.entity.PatientProfile;
import com.comong.backend.domain.patient.repository.PatientProfileRepository;
import com.comong.backend.domain.user.entity.User;
import com.comong.backend.domain.user.repository.UserRepository;
import com.comong.backend.global.security.JwtTokenProvider;

import lombok.RequiredArgsConstructor;

/**
 * MVP 데모 전용 토큰 발급 서비스.
 *
 * <p>Flyway seed 로 데모 데이터를 영구히 박지 않고, 데모 토큰 요청 시 필요한 사용자/환자 프로필을 lazy 하게 생성한다. 데모 토큰 컨트롤러는
 * local/dev/test 프로파일에서만 열린다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DemoAuthService {

    private static final String DEMO_EMAIL = "demo@comong.local";
    private static final String DEMO_NICKNAME = "comong-demo";
    private static final String DEMO_PATIENT_NAME = "데모";
    private static final String DEMO_PATIENT_NICKNAME = "demo-kid";
    private static final LocalDate DEMO_PATIENT_BIRTH_DATE = LocalDate.of(2020, 1, 1);

    private final UserRepository userRepository;
    private final PatientProfileRepository patientProfileRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    @Transactional
    public TokenResponse issueDemoToken() {
        User user = findOrCreateDemoUser();
        ensureDemoPatientProfile(user);

        String token =
                jwtTokenProvider.createAccessToken(user.getId(), user.getEmail(), user.getRole());
        return TokenResponse.of(token, jwtTokenProvider.getAccessTokenTtlSeconds());
    }

    private User findOrCreateDemoUser() {
        return userRepository
                .findByEmail(DEMO_EMAIL)
                .orElseGet(
                        () ->
                                userRepository.save(
                                        User.builder()
                                                .email(DEMO_EMAIL)
                                                .nickname(DEMO_NICKNAME)
                                                .password(
                                                        passwordEncoder.encode(
                                                                UUID.randomUUID().toString()))
                                                .build()));
    }

    private void ensureDemoPatientProfile(User user) {
        if (patientProfileRepository.existsByUserId(user.getId())) {
            return;
        }
        patientProfileRepository.save(
                PatientProfile.builder()
                        .user(user)
                        .name(DEMO_PATIENT_NAME)
                        .nickname(DEMO_PATIENT_NICKNAME)
                        .birthDate(DEMO_PATIENT_BIRTH_DATE)
                        .gender(Gender.MALE)
                        .build());
    }
}
