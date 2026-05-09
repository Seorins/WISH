package com.comong.backend.domain.dialogue.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.comong.backend.domain.dialogue.entity.DialogueTurn;

public interface DialogueTurnRepository extends JpaRepository<DialogueTurn, Long> {

    List<DialogueTurn> findAllBySessionIdOrderByStepIndexAsc(Long sessionId);
}
