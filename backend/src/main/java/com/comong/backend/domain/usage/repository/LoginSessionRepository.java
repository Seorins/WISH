package com.comong.backend.domain.usage.repository;

import java.util.Optional;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import com.comong.backend.domain.usage.entity.LoginSession;

public interface LoginSessionRepository extends JpaRepository<LoginSession, Long> {

    /**
     * heartbeat / end 가 이 메서드를 통해 세션을 가져온다. {@code SELECT ... FOR UPDATE} 로 row 단위 락을 걸어 두 요청이 동시에
     * 들어왔을 때 lost update 를 막는다 — 락 없이 read-modify-save 하면 늦게 커밋한 쪽이 endedAt=NULL 로 되돌리거나 last
     * heartbeat/duration 을 덮어써 idempotent 계약이 깨진다.
     *
     * <p>락 범위는 root entity (`user_login_session`) 만 — patient_profile / users 는 ownership 검증을 위해
     * lazy 로딩되지만 락은 잡히지 않는다 (Hibernate 기본 lock scope NORMAL).
     *
     * <p>start 경로는 새 row 를 INSERT 하므로 락 불필요.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from LoginSession s where s.id = :id")
    Optional<LoginSession> findByIdForUpdate(Long id);
}
