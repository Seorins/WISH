package com.comong.backend.domain.user.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Getter
@Table(
        name = "users",
        uniqueConstraints = {
            // 제약 이름을 명시적으로 부여한다. 회원가입 race 로 unique 위반이 발생했을 때
            // DataIntegrityViolationException 의 cause 에서 constraint name 을 꺼내
            // 어느 컬럼 제약인지 식별하는 데 사용된다 (UserService.create 참고).
            @UniqueConstraint(name = "uk_users_email", columnNames = "email"),
            @UniqueConstraint(name = "uk_users_nickname", columnNames = "nickname")
        })
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String email;

    @Column(nullable = false, length = 30)
    private String nickname;

    /** BCrypt 해시된 비밀번호. 평문은 절대 저장하지 않는다. */
    @Column(nullable = false, length = 100)
    private String password;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    private User(String email, String nickname, String password) {
        this.email = email;
        this.nickname = nickname;
        this.password = password;
    }

    @PrePersist
    void prePersist() {
        this.createdAt = LocalDateTime.now();
    }
}
