package com.comong.backend.domain.user.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.comong.backend.domain.user.entity.User;

public interface UserRepository extends JpaRepository<User, Long> {
    boolean existsByEmail(String email);

    boolean existsByNickname(String nickname);
}
