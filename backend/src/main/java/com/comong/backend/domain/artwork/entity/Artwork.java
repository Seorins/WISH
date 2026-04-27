package com.comong.backend.domain.artwork.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import com.comong.backend.domain.user.entity.User;

import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 사용자가 색칠한 작품. 도안(sketchCode 로 FE 정적 자산과 매칭)과 합성된 결과 이미지(imageUrl), 누적 플레이 시간, 공개 여부를 보관한다.
 *
 * <p>영역별 색상 데이터는 저장하지 않는다. FE 가 imageUrl PNG 를 캔버스에 깔고 덧칠/빈 칸 형태로 수정 UX 를 처리한다.
 */
@Entity
@Getter
@Table(name = "artworks")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Artwork {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // 작품 작성자. User 도메인에 대한 외래키만 잡고, 권한 체크는 service 레이어에서 처리한다.
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** FE 정적 자산의 도안 식별자 (예: "cat-01"). 한 번 정해진 코드는 재사용/변경 금지. */
    @Column(name = "sketch_code", nullable = false, length = 50)
    private String sketchCode;

    /** 사용자 지정 작품 제목. NULL 허용 — 비어있으면 FE 에서 도안명 + 날짜 등으로 표시. */
    @Column(length = 50)
    private String title;

    /** 합성된 결과 이미지의 URL. 실제 파일은 별도 스토리지에 저장된다. */
    @Column(name = "image_url", nullable = false, length = 500)
    private String imageUrl;

    /** 누적 플레이 시간(초). 수정 세션이 추가될 때마다 누적된다. */
    @Column(name = "play_duration_seconds", nullable = false)
    private int playDurationSeconds;

    /** 공개 갤러리 노출 여부. false 면 본인만 조회 가능. */
    @Column(name = "is_public", nullable = false)
    private boolean isPublic;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Builder
    private Artwork(
            User user,
            String sketchCode,
            String title,
            String imageUrl,
            int playDurationSeconds,
            boolean isPublic) {
        this.user = user;
        this.sketchCode = sketchCode;
        this.title = title;
        this.imageUrl = imageUrl;
        this.playDurationSeconds = playDurationSeconds;
        this.isPublic = isPublic;
    }

    @PrePersist
    void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
