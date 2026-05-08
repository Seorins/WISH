package com.comong.backend.domain.dialogue.entity;

/**
 * 대화 상대 NPC 종류.
 *
 * <p>{@link #LIGHTHOUSE} 만 Claude (GMS) 가 다음 질문/선택지를 생성한다. 마을 주민 5인은 사전 작성된 정적 스크립트로 진행되며 동일한 turns
 * 스키마에 저장되어 향후 보고서 집계에서 함께 분석된다.
 */
public enum NpcType {
    LIGHTHOUSE,
    NURSE_RABBIT,
    DEER,
    SLEEPING_SHEEP,
    MONKEY,
    GARDENER_BEAR
}
