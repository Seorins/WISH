# 보호자 계정 / 환자 프로필 구조

이 문서는 **결정 기록(ADR)** 이다. 기능 사용법이 아닌 "왜 이렇게 설계했는가" 를 남긴다. 코드/Swagger 로 표현되지 않는 정책·의도·미도입 배경을 남겨 향후 팀원이 맥락 없이 뒤집지 않도록 한다.

## 1. 한 줄 결정

MVP 에서는 **보호자가 로그인 주체**이고, 환자는 보호자 계정 아래의 **프로필**로 관리한다.

- `User` = 보호자 계정 (로그인 주체)
- `PatientProfile` = 실제 게임 플레이 대상자 (아동)
- `patient_profiles.user_id → users.id` FK 로 관계 표현

## 2. 왜 이렇게 결정했는가

- 소아암 환자 대상 서비스라 실제 사용자는 대체로 아동이며, 이메일/비밀번호를 직접 관리하는 것이 UX·책임·동의 측면에서 부담이 크다.
- 감정/플레이 기록 같은 민감 데이터는 **보호자 동의·관리** 가 전제되어야 한다.
- 환자를 독립 로그인 계정으로 두면 "누가 로그인했는가" 와 "누가 플레이했는가" 가 섞여 권한 설계가 불필요하게 복잡해진다.

## 3. 데이터 모델

### 3.1 엔티티

- `User` — 로그인 주체. 필드: `id, email, nickname, password, createdAt`.
- `PatientProfile` — 플레이 대상자. 필드: `id, user(FK), name, nickname, birthDate, gender, createdAt`.

### 3.2 FK 네이밍

- FK 컬럼은 **`user_id`** 로 둔다 (`guardian_id` 아님).
- 지금 User 는 보호자 역할만 존재하므로 `user_id` 가 현재 상태를 정확히 기술한다.
- 의료진 등 역할이 **실제로** 추가되는 시점에 구조에 맞춰 rename 을 검토한다 (마이그레이션 + IDE 리팩터링으로 저비용).
- "미래 대비" 만으로 `guardian_id` 를 선택하지 않는다 — 아직 확정되지 않은 설계에 이름을 고정하는 것은 추측 기반.

### 3.3 DB 제약

- `patient_profiles.user_id` 에 FK 제약(`fk_patient_profiles_user`) 과 인덱스(`idx_patient_profiles_user_id`) 만 존재한다.
- `user_id` 에 **unique 제약은 두지 않는다** — 구조적으로 `1:N` 확장성을 유지하기 위함. "보호자 1명당 환자 1명" 제한은 5절 참고.

## 4. API 설계

### 4.1 엔드포인트

| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/users/me` | 보호자 본인 정보 |
| POST | `/patient-profiles` | 환자 프로필 등록 (201 + Location) |
| GET | `/patient-profiles` | 본인 소유 환자 프로필 목록 |
| GET | `/patient-profiles/{id}` | 단건 조회 |

### 4.2 소유 관계 표현

- URL 네스팅(`/users/me/patient-profiles`) 이 아니라 **JWT principal** 로 소유자를 결정한다.
- 자원은 평평하게 (`/patient-profiles`) 두고, 서버가 인증된 보호자 기준으로 필터한다.
- `/users/me` 에 환자 정보를 embed 하지 않는다 — 리소스 경계를 섞지 않기 위함 (프론트는 필요 시 병렬 호출).

### 4.3 에러 응답

| 상황 | 상태 | 코드 |
| --- | --- | --- |
| 보호자가 이미 환자 프로필을 가짐 | 409 | `P-002` |
| 프로필이 없거나 본인 소유가 아님 | 404 | `P-001` |

- 비소유 자원에 대해 403 이 아닌 **404** 로 응답한다. 403 은 "ID 는 존재한다" 는 사실을 유출해 순차 PK enumeration 에 단서를 준다.

## 5. MVP 정책

### 5.1 보호자 1인당 환자 1명

- **서비스 계층**(`PatientProfileService.create`) 에서 `existsByUserId` 로 선검사 후 409.
- DB unique 제약은 **두지 않는다** — 정책과 스키마를 분리해, 다중 환자로 전환할 때 마이그레이션 없이 서비스 규칙만 수정할 수 있다.
- 즉 **구조는 `1:N`, 정책만 `1:1`**.

### 5.2 PIN/프로필 선택 흐름 미도입

- 넷플릭스 프로필처럼 여러 프로필을 두고 아이가 PIN 으로 선택하는 흐름은 **도입하지 않는다**.
- MVP 는 보호자가 로그인하면 그대로 아이가 이어서 플레이하는 단순 흐름. 이후 보호자 세션 유지 상태에서 아이가 바로 접속 가능한 UX 로 완화한다.
- 이유: 환자 1명 전제에서 PIN 은 부가 가치 없는 마찰이고, 민감 데이터 경계는 이미 "보호자 세션" 하나로 충분.

## 6. 확장 방향

### 6.1 다중 환자 (형제자매 등)

- 엔티티·스키마 변경 없음. 서비스의 1:1 제약만 제거하고, 응답 DTO 를 list 로 확장.
- 프론트의 프로필 선택 UX 가 이 시점에 비로소 의미를 가진다.

### 6.2 의료진 계정

- 선호 방식: **`User` 확장** (role 컬럼 도입).
  - 이유: 로그인/JWT/Spring Security 인프라를 공유. 별도 테이블은 auth 로직을 두 벌로 관리해야 하는 부담.
- 환자와 의료진의 관계는 **별도 조인 테이블** (`patient_clinicians` 등) 로 표현. 보호자와 의료진은 patient 에 대해 역할이 다르므로 같은 FK 에 섞지 않는다.
- 이 시점에 `patient_profiles.user_id` 를 `guardian_id` 로 rename 하는 편이 자연스럽다 (의료진 추가 후엔 `user_id` 가 모호해지기 때문).

### 6.3 범위 밖

- 의료진 페이지·리포트 공유 기능은 별도 Epic 에서 다룬다.
- 본 문서는 MVP 범위의 계정/프로필 구조만 커버한다.

## 7. 참고

- 엔티티: [`User`](../src/main/java/com/comong/backend/domain/user/entity/User.java), [`PatientProfile`](../src/main/java/com/comong/backend/domain/patient/entity/PatientProfile.java)
- 마이그레이션: [`V2__add_patient_profiles.sql`](../src/main/resources/db/migration/V2__add_patient_profiles.sql)
- API: [`PatientProfileController`](../src/main/java/com/comong/backend/domain/patient/controller/PatientProfileController.java)
- 코드 컨벤션: [`conventions.md`](./conventions.md)
