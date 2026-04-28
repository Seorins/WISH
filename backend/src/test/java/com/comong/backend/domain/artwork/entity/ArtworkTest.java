package com.comong.backend.domain.artwork.entity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;

import com.comong.backend.domain.patient.entity.PatientProfile;
import com.comong.backend.domain.user.entity.User;

/**
 * {@link Artwork#isOwnedBy(Long)} 의 실제 navigation 로직을 검증한다 — {@link
 * com.comong.backend.domain.artwork.service.ArtworkAccessCheckerTest} 가 mock 으로 isOwnedBy 반환만 stub
 * 하므로, 본 테스트가 patientProfile→user→id 체인 탐색 자체를 커버한다.
 */
class ArtworkTest {

    @Test
    void isOwnedBy_matchesByPatientProfileUserId() {
        Artwork artwork = artworkOwnedByUserId(1L);

        assertThat(artwork.isOwnedBy(1L)).isTrue();
        assertThat(artwork.isOwnedBy(2L)).isFalse();
    }

    @Test
    void isOwnedBy_returnsFalseForNullUserId() {
        Artwork artwork = artworkOwnedByUserId(1L);

        assertThat(artwork.isOwnedBy(null)).isFalse();
    }

    @Test
    void isOwnedBy_returnsFalseWhenPatientProfileMissing() {
        // 비정상 상태 (DB FK NOT NULL 이라 정상 흐름엔 없음) 를 안전망이 잡는지 확인
        Artwork artwork = artworkWithNullPatientProfile();

        assertThat(artwork.isOwnedBy(1L)).isFalse();
    }

    @Test
    void isOwnedBy_returnsFalseWhenPatientProfileUserMissing() {
        PatientProfile profileWithoutUser = mock(PatientProfile.class);
        when(profileWithoutUser.getUser()).thenReturn(null);

        Artwork artwork =
                Artwork.builder()
                        .patientProfile(profileWithoutUser)
                        .sketchCode("cat-01")
                        .imageUrl("/api/v1/uploads/x.png")
                        .playDurationSeconds(0)
                        .isPublic(false)
                        .build();

        assertThat(artwork.isOwnedBy(1L)).isFalse();
    }

    private Artwork artworkOwnedByUserId(long userId) {
        User user = mock(User.class);
        when(user.getId()).thenReturn(userId);
        PatientProfile profile = mock(PatientProfile.class);
        when(profile.getUser()).thenReturn(user);

        return Artwork.builder()
                .patientProfile(profile)
                .sketchCode("cat-01")
                .imageUrl("/api/v1/uploads/x.png")
                .playDurationSeconds(0)
                .isPublic(false)
                .build();
    }

    private Artwork artworkWithNullPatientProfile() {
        return Artwork.builder()
                .patientProfile(null)
                .sketchCode("cat-01")
                .imageUrl("/api/v1/uploads/x.png")
                .playDurationSeconds(0)
                .isPublic(false)
                .build();
    }
}
