package com.comong.backend.domain.dialogue.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.comong.backend.domain.dialogue.entity.DialogueSession;

public interface DialogueSessionRepository extends JpaRepository<DialogueSession, Long> {}
