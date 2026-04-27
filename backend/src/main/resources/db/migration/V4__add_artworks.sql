-- V4: artworks 테이블 추가. 색칠하기 미술 도메인의 작품 결과물 저장.
-- 이 파일은 한 번 적용된 후 절대 수정하지 않는다. 변경이 필요하면 V5, V6... 로 추가한다.
-- ddl-auto=validate 이므로 Artwork 엔티티와 컬럼 타입/길이/nullable/제약 이름이 정확히 일치해야 한다.

CREATE TABLE artworks (
    id                    BIGSERIAL     PRIMARY KEY,
    user_id               BIGINT        NOT NULL,
    sketch_code           VARCHAR(50)   NOT NULL,
    title                 VARCHAR(50),
    image_url             VARCHAR(500)  NOT NULL,
    play_duration_seconds INTEGER       NOT NULL DEFAULT 0,
    is_public             BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at            TIMESTAMP(6)  NOT NULL,
    updated_at            TIMESTAMP(6)  NOT NULL,
    CONSTRAINT fk_artworks_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 마이페이지 "내 작품 최신순" 조회용
CREATE INDEX idx_artworks_user_created   ON artworks (user_id, created_at DESC);

-- 공개 갤러리 "최신 공개작 최신순" 조회용
CREATE INDEX idx_artworks_public_created ON artworks (is_public, created_at DESC);
