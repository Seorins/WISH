package com.comong.backend.domain.village.realtime.service;

import java.util.Set;

/**
 * 마을 광장에서 사용 가능한 이모지 화이트리스트 (S14P31E103-728).
 *
 * <p>아이용 톤에 맞춰 6개로 제한. FE 팔레트도 같은 목록을 노출. 도배 차단은 {@link VillagePresenceService#registerEmote} 의
 * throttle 이 담당하므로 본 목록은 의미적 검증 (안전·기획) 만 수행.
 */
public final class VillageEmojis {

    public static final Set<String> ALLOWED = Set.of("😄", "😢", "👍", "❤️", "✨", "🐰");

    private VillageEmojis() {}

    public static boolean isAllowed(String emoji) {
        return emoji != null && ALLOWED.contains(emoji);
    }
}
