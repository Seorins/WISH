-- V12: Add role column to users for ADMIN authorization (S14P31E103-300).
--
-- 기존 행은 모두 USER 로 채운다 (DEFAULT 'USER' 가 backfill 도 담당).
-- ADMIN 부여는 회원가입 흐름이 아닌 SECURITY_ADMIN_EMAILS 환경변수 기반 부팅 시 promote 로 처리된다.
-- DEFAULT 는 향후 운영 SQL 로 직접 INSERT 하는 케이스(시드/패치)의 안전망으로 유지.

ALTER TABLE users
    ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'USER';
