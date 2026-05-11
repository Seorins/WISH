package com.comong.backend.domain.notification.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.comong.backend.domain.notification.dto.DeviceTokenDeactivateRequest;
import com.comong.backend.domain.notification.dto.DeviceTokenRegisterRequest;
import com.comong.backend.domain.notification.dto.DeviceTokenResponse;
import com.comong.backend.domain.notification.entity.GuardianDeviceToken;
import com.comong.backend.domain.notification.repository.GuardianDeviceTokenRepository;
import com.comong.backend.domain.patient.exception.PatientErrorCode;
import com.comong.backend.domain.patient.repository.PatientProfileRepository;
import com.comong.backend.domain.user.entity.User;
import com.comong.backend.domain.user.exception.UserErrorCode;
import com.comong.backend.domain.user.repository.UserRepository;
import com.comong.backend.global.exception.BusinessException;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GuardianDeviceTokenService {

    private final GuardianDeviceTokenRepository guardianDeviceTokenRepository;
    private final UserRepository userRepository;
    private final PatientProfileRepository patientProfileRepository;

    @Transactional
    public DeviceTokenResponse register(Long userId, DeviceTokenRegisterRequest request) {
        validatePatientProfileOwnership(userId, request.patientProfileId());
        User user =
                userRepository
                        .findById(userId)
                        .orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));

        GuardianDeviceToken deviceToken =
                guardianDeviceTokenRepository
                        .findByDeviceToken(request.token())
                        .map(
                                existing -> {
                                    existing.reactivate(
                                            user, request.platform(), request.userAgent());
                                    return existing;
                                })
                        .orElseGet(
                                () ->
                                        guardianDeviceTokenRepository.save(
                                                GuardianDeviceToken.builder()
                                                        .user(user)
                                                        .deviceToken(request.token())
                                                        .platform(request.platform())
                                                        .userAgent(request.userAgent())
                                                        .build()));

        return DeviceTokenResponse.from(deviceToken);
    }

    @Transactional
    public void deactivate(Long userId, DeviceTokenDeactivateRequest request) {
        guardianDeviceTokenRepository
                .findByUserIdAndDeviceToken(userId, request.token())
                .ifPresent(GuardianDeviceToken::deactivate);
    }

    private void validatePatientProfileOwnership(Long userId, Long patientProfileId) {
        if (patientProfileId == null) {
            return;
        }
        if (!patientProfileRepository.existsByIdAndUserId(patientProfileId, userId)) {
            throw new BusinessException(PatientErrorCode.PATIENT_PROFILE_NOT_FOUND);
        }
    }
}
