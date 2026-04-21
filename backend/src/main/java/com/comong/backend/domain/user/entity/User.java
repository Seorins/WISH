package com.comong.backend.domain.user.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Getter
@Table(name = "users")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String email;

    @Column(nullable = false, unique = true, length = 30)
    private String nickname;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    private User(String email, String nickname) {
        this.email = email;
        this.nickname = nickname;
    }

    @PrePersist
    void prePersist() {
        this.createdAt = LocalDateTime.now();
    }
}
