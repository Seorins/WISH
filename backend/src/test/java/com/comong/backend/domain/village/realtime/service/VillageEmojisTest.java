package com.comong.backend.domain.village.realtime.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class VillageEmojisTest {

    @Test
    void allowedContainsShiftedPaletteAndBeltBoasts() {
        assertThat(VillageEmojis.ALLOWED)
                .contains(
                        "안녕", "따라와", "좋아", "고마워", "😄", "😢", "👍", "❤️", "❓", "🥋흰띠", "🥋노란띠",
                        "🥋주황띠", "🥋초록띠", "🥋파란띠", "🥋보라띠", "🥋갈색띠", "🥋빨간띠", "🥋검은띠");
    }

    @Test
    void removedCheerUpMessageIsDropped() {
        assertThat(VillageEmojis.isAllowed("힘내")).isFalse();
    }
}
