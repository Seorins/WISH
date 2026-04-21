# Backend

`comong` 게임 서비스의 백엔드 애플리케이션.

## 기술 스택

- Java 21
- Spring Boot 4.0.5
- Gradle 9.4.1
- PostgreSQL
- Spring Data JPA (Hibernate)

> Spring Boot 4.0 모듈화로 starter POM 이름이 3.x 와 다릅니다. `spring-boot-starter-web` → `spring-boot-starter-webmvc`, feature별 `*-test` starter 등. 의존성 추가 시 4.0 기준 이름을 확인하세요.

## 실행 방법

### 1. 필수 환경

- JDK 21
- PostgreSQL (로컬 DB 기동 필요)

### 2. 환경 변수

프로파일과 무관하게 아래 3개는 반드시 설정.

| 변수 | 설명 | 예시 |
| --- | --- | --- |
| `DB_URL` | JDBC URL | `jdbc:postgresql://localhost:5432/comong` |
| `DB_USERNAME` | DB 사용자 | `comong` |
| `DB_PASSWORD` | DB 비밀번호 | `comong` |
| `SPRING_PROFILES_ACTIVE` | 프로파일 (미설정 시 `local`) | `local` / `dev` / `prod` |

IntelliJ `Run Configuration > Environment variables` 또는 쉘 `export` 로 주입.

### 3. 빌드 & 실행

```bash
./gradlew bootRun
# 또는
./gradlew build && java -jar build/libs/backend-0.0.1-SNAPSHOT.jar
```

기본 포트: `8080`, 컨텍스트 경로: `/api/v1`
헬스체크: `GET /api/v1/actuator/health`

## 프로파일

| 프로파일 | 용도 | JPA `ddl-auto` | 로깅 |
| --- | --- | --- | --- |
| `local` | 개발자 로컬 | `update` + SQL 로그 | CONSOLE, 앱 DEBUG, SQL/바인딩 TRACE |
| `dev` | 통합 개발 서버 | `validate` | CONSOLE + FILE, 앱 DEBUG |
| `prod` | 운영 | `validate` | CONSOLE + FILE, root WARN / 앱 INFO |

로그 파일은 `./logs/backend.log` 에 쌓이며 100MB/30일 기준으로 롤링됩니다.

## 디렉토리 구조

```
backend/src/main/java/com/comong/backend
├─ BackendApplication.java
├─ global/                 # 애플리케이션 전역 요소
│  ├─ common/response/     # ApiResponse 등 공통 응답 포맷
│  ├─ config/              # 설정 클래스
│  └─ exception/           # ErrorCode, BusinessException, GlobalExceptionHandler
└─ domain/                 # 비즈니스 도메인별 패키지
   └─ user/
      ├─ controller/
      ├─ service/
      ├─ repository/
      ├─ entity/
      ├─ dto/
      └─ exception/        # UserErrorCode 등 도메인 에러 enum
```

## 코드 포매팅

Spotless + Google Java Format 으로 강제합니다.

```bash
./gradlew spotlessApply   # 자동 수정
./gradlew spotlessCheck   # 검사만
```

빌드·CI 가 `spotlessCheck` 를 포함하므로 포맷이 어긋난 코드는 머지 불가입니다.

## 코드 컨벤션

별도 문서 참고: [docs/conventions.md](docs/conventions.md)

새 도메인을 추가할 때는 `domain/user/` 구조를 복붙해서 따라가세요.
