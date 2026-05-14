package com.comong.backend.domain.quiz.dto;

/** 출제자에게만 user queue 로 전달되는 라운드 제시어. 정답자는 글자수 힌트만 별도 페이로드로 받는다 (M2-5 예정). */
public record PromptAssignment(int roundNumber, String word, String hint) {}
