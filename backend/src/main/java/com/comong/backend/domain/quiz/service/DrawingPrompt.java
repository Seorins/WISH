package com.comong.backend.domain.quiz.service;

/** 그림 퀴즈 제시어 한 건 — 단어 + 짧은 힌트. FE 의 drawingPrompts.ts 와 동일 톤. */
public record DrawingPrompt(String word, String hint) {}
