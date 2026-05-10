package com.comong.backend.domain.dialogue.entity;

/**
 * 대화 상대 NPC 의 고유 이름.
 *
 * <p>{@link #YEONGCHEOL} (등대지기) 만 Claude (GMS) 를 사용해 BE 가 다음 질문/선택지를 생성한다. 마을 주민 6인은 FE 가 정적
 * 스크립트(질문 / 선택지 / 다음 scene 라우팅 / closingLines)를 모두 보유한다. BE 는 마을 주민에 대해선 세션 lifecycle 관리와 turn raw
 * 데이터 적재만 담당한다.
 *
 * <p>한글 캐릭터 매핑:
 *
 * <ul>
 *   <li>{@link #YEONGCHEOL} — 등대지기 영철 (LLM, BE 가 scene/closing 생성)
 *   <li>{@link #JOEUN} — 간호사 토끼 (FE 정적)
 *   <li>{@link #DAIN} — 사슴 친구 (FE 정적)
 *   <li>{@link #GEONBIN} — 잠자는 양 (FE 정적)
 *   <li>{@link #SEORIN} — 원숭이 친구 (FE 정적)
 *   <li>{@link #JEONGHO} — 정원사 곰 (FE 정적)
 *   <li>{@link #SEHYEON} — 다람쥐 주민 (FE 정적)
 * </ul>
 */
public enum NpcName {
    YEONGCHEOL,
    JOEUN,
    DAIN,
    GEONBIN,
    SEORIN,
    JEONGHO,
    SEHYEON;

    /** BE 가 scene 생성/라우팅을 책임지는 NPC 인지. 마을 주민(FE 정적)은 false. */
    public boolean isBackendDriven() {
        return this == YEONGCHEOL;
    }
}
