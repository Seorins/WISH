package com.comong.backend.domain.quiz.service;

import java.security.SecureRandom;
import java.util.List;
import java.util.Objects;

import org.springframework.stereotype.Component;

/**
 * 그림 퀴즈 멀티플레이 제시어 풀 (S14P31E103-820).
 *
 * <p>어른 타깃 캐치마인드 톤 — 한국 음식·일상·놀이·감정·전통 100개. 라운드마다 직전 단어는 제외하고 무작위 선택.
 *
 * <p>운영 가정: 단어 풀은 빈도 낮은 정적 컨텐츠라 DB/리소스 파일 분리 없이 코드 내 상수. 풀이 커지거나 다국어가 되면 그때 외부화.
 */
@Component
public class QuizPromptCatalog {

    private static final List<DrawingPrompt> PROMPTS =
            List.of(
                    // 한국 음식 (11)
                    new DrawingPrompt("삼겹살"),
                    new DrawingPrompt("곱창"),
                    new DrawingPrompt("양념치킨"),
                    new DrawingPrompt("짜장면"),
                    new DrawingPrompt("짬뽕"),
                    new DrawingPrompt("떡볶이"),
                    new DrawingPrompt("김치찌개"),
                    new DrawingPrompt("라면"),
                    new DrawingPrompt("만두"),
                    new DrawingPrompt("호떡"),
                    new DrawingPrompt("붕어빵"),
                    // 음료 (2)
                    new DrawingPrompt("아메리카노"),
                    new DrawingPrompt("콜라"),
                    // 직장·일상 (7)
                    new DrawingPrompt("야근"),
                    new DrawingPrompt("휴가"),
                    new DrawingPrompt("면접"),
                    new DrawingPrompt("출근길"),
                    new DrawingPrompt("월요병"),
                    new DrawingPrompt("빨래"),
                    new DrawingPrompt("설거지"),
                    // 장소 (8)
                    new DrawingPrompt("헬스장"),
                    new DrawingPrompt("사우나"),
                    new DrawingPrompt("찜질방"),
                    new DrawingPrompt("노래방"),
                    new DrawingPrompt("PC방"),
                    new DrawingPrompt("영화관"),
                    new DrawingPrompt("한옥"),
                    new DrawingPrompt("시장"),
                    // 활동·놀이 (9)
                    new DrawingPrompt("조깅"),
                    new DrawingPrompt("등산"),
                    new DrawingPrompt("캠핑"),
                    new DrawingPrompt("낚시"),
                    new DrawingPrompt("골프"),
                    new DrawingPrompt("윷놀이"),
                    new DrawingPrompt("가위바위보"),
                    new DrawingPrompt("제기차기"),
                    new DrawingPrompt("강강술래"),
                    // 감정·상황·연애 (9)
                    new DrawingPrompt("거짓말"),
                    new DrawingPrompt("첫사랑"),
                    new DrawingPrompt("짝사랑"),
                    new DrawingPrompt("데이트"),
                    new DrawingPrompt("청혼"),
                    new DrawingPrompt("다이어트"),
                    new DrawingPrompt("불면증"),
                    new DrawingPrompt("야식"),
                    new DrawingPrompt("권태기"),
                    // 자연·날씨 (10)
                    new DrawingPrompt("일출"),
                    new DrawingPrompt("일몰"),
                    new DrawingPrompt("보름달"),
                    new DrawingPrompt("폭포"),
                    new DrawingPrompt("무지개"),
                    new DrawingPrompt("천둥번개"),
                    new DrawingPrompt("화산"),
                    new DrawingPrompt("황사"),
                    new DrawingPrompt("장마"),
                    new DrawingPrompt("단풍"),
                    // 식물·나무 (6)
                    new DrawingPrompt("사시나무"),
                    new DrawingPrompt("가로수"),
                    new DrawingPrompt("코스모스"),
                    new DrawingPrompt("해바라기"),
                    new DrawingPrompt("단풍나무"),
                    new DrawingPrompt("은행나무"),
                    // 동물 (10)
                    new DrawingPrompt("펭귄"),
                    new DrawingPrompt("코끼리"),
                    new DrawingPrompt("기린"),
                    new DrawingPrompt("캥거루"),
                    new DrawingPrompt("부엉이"),
                    new DrawingPrompt("박쥐"),
                    new DrawingPrompt("악어"),
                    new DrawingPrompt("상어"),
                    new DrawingPrompt("문어"),
                    new DrawingPrompt("호랑이"),
                    // 한국 동물·곤충 (4)
                    new DrawingPrompt("까치"),
                    new DrawingPrompt("매미"),
                    new DrawingPrompt("잠자리"),
                    new DrawingPrompt("미꾸라지"),
                    // 캐릭터·판타지 (5)
                    new DrawingPrompt("산타클로스"),
                    new DrawingPrompt("마법사"),
                    new DrawingPrompt("우주인"),
                    new DrawingPrompt("도깨비"),
                    new DrawingPrompt("인어"),
                    // 일상 사물 (6)
                    new DrawingPrompt("카메라"),
                    new DrawingPrompt("자전거"),
                    new DrawingPrompt("헤드폰"),
                    new DrawingPrompt("우산"),
                    new DrawingPrompt("모래시계"),
                    new DrawingPrompt("풍차"),
                    // 한국 전통·문화 (5)
                    new DrawingPrompt("한복"),
                    new DrawingPrompt("부채"),
                    new DrawingPrompt("갓"),
                    new DrawingPrompt("거북선"),
                    new DrawingPrompt("장구"),
                    // 명절·이벤트 (8)
                    new DrawingPrompt("추석"),
                    new DrawingPrompt("설날"),
                    new DrawingPrompt("어버이날"),
                    new DrawingPrompt("어린이날"),
                    new DrawingPrompt("크리스마스"),
                    new DrawingPrompt("결혼식"),
                    new DrawingPrompt("졸업식"),
                    new DrawingPrompt("운동회"));

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
