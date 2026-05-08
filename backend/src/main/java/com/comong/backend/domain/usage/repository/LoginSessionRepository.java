package com.comong.backend.domain.usage.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.comong.backend.domain.usage.entity.LoginSession;

public interface LoginSessionRepository extends JpaRepository<LoginSession, Long> {

    /**
     * 권한 체크용 — patientProfile + user 까지 join fetch 해서 단일 SELECT 로 owner 비교.
     *
     * <p>LAZY 로 두면 {@code session.getPatientProfile().getUser().getId()} 호출 시 추가 SELECT 가 발생.
     * heartbeat / end 가 매 호출 단건이라 N+1 충격은 작지만, owner 비교는 빈번히 일어나므로 명시적 fetch 가 깔끔.
     */
    @Query(
            "select s from LoginSession s "
                    + "join fetch s.patientProfile p "
                    + "join fetch p.user "
                    + "where s.id = :id")
    Optional<LoginSession> findByIdWithPatientAndUser(Long id);
}
