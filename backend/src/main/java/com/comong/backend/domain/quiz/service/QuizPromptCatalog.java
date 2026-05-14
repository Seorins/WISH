package com.comong.backend.domain.quiz.service;

import java.security.SecureRandom;
import java.util.List;
import java.util.Objects;

import org.springframework.stereotype.Component;

/**
 * 그림 퀴즈 멀티플레이 제시어 풀 (S14P31E103-820).
 *
 * <p>아동 친화 단어 위주 — FE 의 {@code drawingPrompts.ts} 와 동일 컨셉. 라운드마다 직전 단어는 제외하고 무작위 선택.
 *
 * <p>운영 가정: 단어 풀은 빈도 낮은 정적 컨텐츠라 DB/리소스 파일 분리 없이 코드 내 상수. 풀이 커지거나 다국어가 되면 그때 외부화.
 */
@Component
public class QuizPromptCatalog {

    private static final List<DrawingPrompt> PROMPTS =
            List.of(
                    new DrawingPrompt("사과", "빨갛고 동그래요"),
                    new DrawingPrompt("바나나", "길고 노래요"),
                    new DrawingPrompt("수박", "줄무늬가 있어요"),
                    new DrawingPrompt("딸기", "점이 콕콕 박혀요"),
                    new DrawingPrompt("집", "지붕과 문이 있어요"),
                    new DrawingPrompt("나무", "뿌리와 잎이 있어요"),
                    new DrawingPrompt("꽃", "꽃잎이 동그랗게 모여요"),
                    new DrawingPrompt("해", "동그라미 주변에 햇살이 뻗어요"),
                    new DrawingPrompt("달", "밤하늘에 떠 있어요"),
                    new DrawingPrompt("별", "뾰족뾰족 다섯 갈래"),
                    new DrawingPrompt("구름", "말랑말랑 동글동글"),
                    new DrawingPrompt("비", "하늘에서 떨어져요"),
                    new DrawingPrompt("무지개", "둥글게 휜 줄무늬"),
                    new DrawingPrompt("눈사람", "동그라미 두 개를 쌓아요"),
                    new DrawingPrompt("고양이", "귀가 뾰족하고 꼬리가 있어요"),
                    new DrawingPrompt("강아지", "귀가 늘어지고 꼬리를 흔들어요"),
                    new DrawingPrompt("토끼", "귀가 길어요"),
                    new DrawingPrompt("곰", "몸이 통통하고 귀가 둥글어요"),
                    new DrawingPrompt("물고기", "꼬리 지느러미가 있어요"),
                    new DrawingPrompt("새", "날개가 있어요"),
                    new DrawingPrompt("나비", "날개에 무늬가 있어요"),
                    new DrawingPrompt("거북이", "등껍질이 있어요"),
                    new DrawingPrompt("자동차", "바퀴 네 개가 있어요"),
                    new DrawingPrompt("기차", "길게 이어진 칸이 있어요"),
                    new DrawingPrompt("비행기", "날개와 꼬리가 있어요"),
                    new DrawingPrompt("배", "물 위에 떠요"),
                    new DrawingPrompt("풍선", "동그랗고 줄이 달려있어요"),
                    new DrawingPrompt("우산", "비올 때 펴요"),
                    new DrawingPrompt("안경", "동그라미 두 개가 이어져요"),
                    new DrawingPrompt("시계", "바늘이 두 개예요"),
                    new DrawingPrompt("연필", "한쪽이 뾰족해요"),
                    new DrawingPrompt("컵", "손잡이가 있을 수도 있어요"),
                    new DrawingPrompt("케이크", "초가 꽂혀있어요"),
                    new DrawingPrompt("아이스크림", "콘 위에 동그라미가 얹혀있어요"),
                    new DrawingPrompt("도넛", "가운데가 뚫린 동그라미"),
                    new DrawingPrompt("하트", "사랑을 나타내요"),
                    new DrawingPrompt("왕관", "뾰족뾰족 윗부분"),
                    new DrawingPrompt("공", "동그래요"),
                    new DrawingPrompt("책", "펼치면 두 장이 보여요"),
                    new DrawingPrompt("열쇠", "문을 여는 도구예요"));

    private final SecureRandom random = new SecureRandom();

    /** 직전 단어({@code exclude}) 와 다른 제시어를 무작위로 하나 뽑는다. 풀이 1개 이하이거나 exclude 가 null/blank 면 그냥 무작위. */
    public DrawingPrompt pickRandom(String excludeWord) {
        if (PROMPTS.size() <= 1 || excludeWord == null || excludeWord.isBlank()) {
            return PROMPTS.get(random.nextInt(PROMPTS.size()));
        }
        DrawingPrompt picked;
        do {
            picked = PROMPTS.get(random.nextInt(PROMPTS.size()));
        } while (Objects.equals(picked.word(), excludeWord));
        return picked;
    }

    public int size() {
        return PROMPTS.size();
    }
}
