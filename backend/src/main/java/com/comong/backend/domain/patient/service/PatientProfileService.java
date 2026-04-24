package com.comong.backend.domain.patient.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.comong.backend.domain.patient.dto.PatientProfileCreateRequest;
import com.comong.backend.domain.patient.dto.PatientProfileResponse;
import com.comong.backend.domain.patient.entity.PatientProfile;
import com.comong.backend.domain.patient.exception.PatientErrorCode;
import com.comong.backend.domain.patient.repository.PatientProfileRepository;
import com.comong.backend.domain.user.entity.User;
import com.comong.backend.domain.user.exception.UserErrorCode;
import com.comong.backend.domain.user.service.UserService;
import com.comong.backend.global.exception.BusinessException;

import lombok.RequiredArgsConstructor;

/**
 * 환자 프로필 유스케이스 (등록/조회).
 *
 * <p>소유 관계: 모든 조회/등록은 인증된 보호자 계정(User) 기준으로 필터링한다. URL 네스팅 대신 principal 로 소유자를 결정한다.
 *
 * <p>MVP 제약: 보호자 당 환자 프로필은 1개로 제한한다. DB 레벨 unique 제약이 아니라 본 서비스의 {@code existsByUserId} 선검사로 강제한다.
 * 구조적 확장성(1:N) 은 유지하되, 정책적으로 1개만 허용하는 것이 의도.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PatientProfileService {

    private final PatientProfileRepository patientProfileRepository;
    private final UserService userService;

    @Transactional
    public PatientProfileResponse create(Long userId, PatientProfileCreateRequest request) {
        if (patientProfileRepository.existsByUserId(userId)) {
            throw new BusinessException(PatientErrorCode.PATIENT_PROFILE_ALREADY_EXISTS);
        }
        User user =
                userService
                        .findEntityById(userId)
                        .orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));
        PatientProfile saved =
                patientProfileRepository.save(
                        PatientProfile.builder()
                                .user(user)
                                .name(request.name())
                                .nickname(request.nickname())
                                .birthDate(request.birthDate())
                                .gender(request.gender())
                                .build());
        return PatientProfileResponse.from(saved);
    }

    public List<PatientProfileResponse> findMine(Long userId) {
        return patientProfileRepository.findAllByUserId(userId).stream()
                .map(PatientProfileResponse::from)
                .toList();
    }

    /**
     * 단건 조회. 존재하지 않거나 본인 소유가 아닌 경우 모두 404 로 응답한다. 403 을 반환하면 "ID 는 존재한다" 는 사실이 유출되어 순차 PK 를
     * enumerate 하는 공격자에게 ID 공간 밀도를 알려줄 수 있기 때문.
     */
    public PatientProfileResponse findOne(Long userId, Long profileId) {
        PatientProfile profile =
                patientProfileRepository
                        .findById(profileId)
                        .filter(p -> p.getUser().getId().equals(userId))
                        .orElseThrow(
                                () ->
                                        new BusinessException(
                                                PatientErrorCode.PATIENT_PROFILE_NOT_FOUND));
        return PatientProfileResponse.from(profile);
    }
}
