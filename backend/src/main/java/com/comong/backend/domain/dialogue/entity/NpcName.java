package com.comong.backend.domain.dialogue.entity;

/**
 * 대화 상대 NPC 의 고유 이름.
 *
 * <p>{@link #YEONGCHEOL} (등대지기) 만 Claude (GMS) 가 다음 질문/선택지를 생성한다. 마을 주민 5인은 사전 작성된 정적 스크립트로 진행되며
 * 동일한 turns 스키마에 저장되어 향후 보고서 집계에서 함께 분석된다.
 *
 * <p>한글 캐릭터 매핑:
 *
 * <ul>
 *   <li>{@link #YEONGCHEOL} — 등대지기 영철 (LLM)
 *   <li>{@link #JOEUN} — 간호사 토끼
 *   <li>{@link #DAIN} — 사슴 친구
 *   <li>{@link #GEONBIN} — 잠자는 양
 *   <li>{@link #SEORIN} — 원숭이 친구
 *   <li>{@link #JEONGHO} — 정원사 곰
 * </ul>
 */
public enum NpcName {
    YEONGCHEOL,
    JOEUN,
    DAIN,
    GEONBIN,
    SEORIN,
    JEONGHO
}
