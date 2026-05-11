package com.comong.backend.domain.notification.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.comong.backend.domain.notification.entity.GuardianDeviceToken;

public interface GuardianDeviceTokenRepository extends JpaRepository<GuardianDeviceToken, Long> {

    Optional<GuardianDeviceToken> findByDeviceToken(String deviceToken);

    Optional<GuardianDeviceToken> findByUserIdAndDeviceToken(Long userId, String deviceToken);

    List<GuardianDeviceToken> findAllByUserIdAndActiveTrue(Long userId);
}
