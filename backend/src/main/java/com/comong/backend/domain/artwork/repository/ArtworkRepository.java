package com.comong.backend.domain.artwork.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.comong.backend.domain.artwork.entity.Artwork;

public interface ArtworkRepository extends JpaRepository<Artwork, Long> {
    // 도메인 특정 쿼리 메서드는 service 작업(218 / 127 / 129 / 131 / 133) 시점에 추가한다.
}
