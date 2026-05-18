-- V37: Add monsters_defeated to taekwondo_session_motion for incremental session saving.
--
-- 배경:
--   체조/태권도 세션이 "모든 동작 완료 후 한 방 저장" 에서 "동작 단위 누적 저장" 으로 전환됨.
--   동작 도중 중단해도 그때까지 잡은 몬스터 수가 띠 승급 누적에 반영되어야 한다 (S14P31E103-861).
--
-- 핵심 결정:
--   - taekwondo_session_motion 에 monsters_defeated 컬럼을 추가하여 동작 단위로 처치수를 보존한다.
--   - taekwondo_session.monsters_defeated 는 그대로 두고, 동작 저장 시 자식 motion 들의 합으로 재계산한다.
--   - 기존 행은 0 으로 초기화 (V14 이후 한 방 저장 시 세션 단위 합만 남아있던 데이터라 동작 단위 분해는 불가).

ALTER TABLE taekwondo_session_motion
    ADD COLUMN monsters_defeated INTEGER NOT NULL DEFAULT 0;

ALTER TABLE taekwondo_session_motion
    ADD CONSTRAINT ck_taekwondo_session_motion_monsters_defeated_non_negative
        CHECK (monsters_defeated >= 0);
