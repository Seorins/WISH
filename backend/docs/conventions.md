# 백엔드 코드 컨벤션

팀 공통 규약입니다. PR 리뷰 시 이 문서를 기준으로 논의합니다.

## 1. 패키지 구조

```
com.comong.backend
├─ global/        # 애플리케이션 전역
│  ├─ common/     # 공통 유틸/응답 포맷 등
│  ├─ config/     # @Configuration 클래스
│  └─ exception/  # 공통 예외 처리
└─ domain/        # 비즈니스 도메인
   └─ <도메인>/
      ├─ controller/
      ├─ service/
      ├─ repository/
      ├─ entity/
      ├─ dto/
      └─ exception/  # 해당 도메인 전용 ErrorCode enum
```

**원칙**
- 도메인 간 의존은 **service 레이어**에서만 허용 (repository/entity 크로스 참조 금지)
- `global/` 패키지는 도메인을 import 하지 않는다 (역방향 의존 금지)
- 공통 추상 클래스/인터페이스는 `global/common/` 에 둔다

## 2. 공통 응답 포맷

모든 REST 응답은 `ApiResponse<T>` 로 감싼다.

```json
{ "code": "SUCCESS", "message": "OK", "data": { ... } }
```

### 사용

```java
return ResponseEntity.ok(ApiResponse.success(dto));
return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(dto));
```

실패 응답은 **직접 만들지 말 것.** `BusinessException` 을 던지면 `GlobalExceptionHandler` 가 알아서 변환한다.

### 필드 설명

| 필드 | 성공 | 비즈니스 실패 | 검증 실패 |
| --- | --- | --- | --- |
| `code` | `"SUCCESS"` | `"U-001"` 등 | `"G-001"` |
| `message` | `"OK"` | 에러코드 정의 메시지 | 입력값 오류 메시지 |
| `data` | 도메인 응답 DTO | `null` | `null` |
| `errors` | `null` | `null` | `{"field": "메시지"}` |

Jackson `@JsonInclude(NON_NULL)` 로 `null` 필드는 응답에서 제외된다.

## 3. 에러 코드 규칙

### 접두사 배정

| 접두사 | 영역 | 예시 |
| --- | --- | --- |
| `G-` | 전역/공통 | `G-001` 입력값 오류, `G-003` 인증 필요, `G-004` 접근 권한 없음 |
| `U-` | User 도메인 | `U-001` 사용자 없음 |
| `A-` | Auth 도메인 | `A-001` 자격증명 불일치, `A-002` 토큰 만료 |
| `(새 접두사)` | 새 도메인 | 신규 도메인 추가 시 팀 논의로 결정 |

### enum 정의

각 도메인은 `<도메인>/exception/` 하위에 enum을 둔다.

```java
@Getter
@RequiredArgsConstructor
public enum UserErrorCode implements ErrorCode {
    USER_NOT_FOUND(HttpStatus.NOT_FOUND, "U-001", "사용자를 찾을 수 없습니다."),
    EMAIL_DUPLICATED(HttpStatus.CONFLICT, "U-002", "이미 사용 중인 이메일입니다.");

    private final HttpStatus status;
    private final String code;
    private final String message;
}
```

**메시지는 사용자에게 노출되는 한글 텍스트**로 작성한다 (프론트가 그대로 표시 가능).

## 4. 예외 처리

### 비즈니스 예외

서비스 레이어에서 에러 상황은 항상 `BusinessException` 으로 던진다.

```java
User user = userRepository.findById(id)
    .orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));
```

금지:
- `throw new RuntimeException(...)`
- `throw new IllegalArgumentException(...)` (입력 검증은 DTO의 `@Valid` 로)
- Controller 에서 `try/catch` 로 상태코드 변환

### 검증 예외

요청 DTO에 Jakarta Validation 어노테이션(`@NotBlank`, `@Email`, `@Size` 등)을 붙이고 컨트롤러에서 `@Valid` 로 받는다. 필드별 메시지는 `GlobalExceptionHandler` 가 Map 으로 만들어 `errors` 에 담아준다.

### 처리되지 않은 예외

`GlobalExceptionHandler.handleUnexpectedException` 에서 500 으로 처리 + `log.error`. 이 로그가 찍히면 **버그**로 간주하고 원인 제거가 우선 (fallback 에 의존하지 않기).

## 5. 엔티티 규칙

- 기본 생성자 접근자: `@NoArgsConstructor(access = AccessLevel.PROTECTED)`
- 객체 생성은 `@Builder` + private 생성자로만 허용 (무분별한 setter 금지)
- setter 는 쓰지 않고, 상태 변경은 의미 있는 메서드(`user.changeNickname(...)`)로 표현
- 테이블명은 **복수형** (`users`, `games`) 으로 통일
- `createdAt` / `updatedAt` 은 `@PrePersist` / `@PreUpdate` 또는 JPA Auditing 사용

## 6. DTO 규칙

- 요청/응답 모두 `record` 사용 (불변 + 간결)
- 엔티티를 Controller 에 그대로 노출하지 않는다 — 반드시 DTO 변환
- 변환 메서드는 DTO 에 둔다 (`UserSignupRequest#toEntity()`, `UserResponse#from(User)`)

## 7. 서비스 레이어

- `@Transactional(readOnly = true)` 를 **클래스 레벨**에 기본으로 둔다
- 쓰기 메서드에만 `@Transactional` 재선언
- `@RequiredArgsConstructor` + `final` 필드로 생성자 주입 (필드/세터 주입 금지)

## 8. 컨트롤러 레이어

- REST 관례 준수
  - 생성: `POST /<resource>` → `201 Created`
  - 조회: `GET /<resource>/{id}` → `200 OK`
  - 수정: `PUT` 또는 `PATCH`
  - 삭제: `DELETE` → `204 No Content`
- 컨트롤러는 **DTO 변환과 HTTP 상태코드만** 담당. 비즈니스 로직 금지
- URL 은 소문자 복수형 (`/users`, `/games`)

## 9. 새 도메인 추가 가이드

1. `domain/<도메인>/` 디렉토리 생성
2. `domain/user/` 의 서브 구조(`controller/service/repository/entity/dto/exception`) 복사
3. 새 `<도메인>ErrorCode` enum 작성 및 접두사 배정 (팀과 협의)
4. 엔티티 → 레포지토리 → DTO → 서비스 → 컨트롤러 순으로 구현
5. 필요시 Flyway 마이그레이션 스크립트 추가 (도입 시점에 가이드 업데이트 예정)

## 10. 코드 포매팅 (Spotless)

[Spotless](https://github.com/diffplug/spotless) + **Google Java Format** 으로 전체 포맷을 강제한다.

### 개발자 사용법

```bash
# 포맷 어긋나면 자동 수정
./gradlew spotlessApply

# 포맷 검사만 (CI 에서 동일하게 실행)
./gradlew spotlessCheck
```

`./gradlew build`, `./gradlew check` 는 내부적으로 `spotlessCheck` 를 실행한다. **포맷이 어긋난 코드는 빌드 실패 → PR 머지 불가.**

### 규칙 요약

- Google Java Format 1.28 **AOSP variant** (4-space indent, 100자 라인)
- import 순서: `java → javax → jakarta → org → com → (기타)`
- 미사용 import 자동 제거
- 파일 끝 개행 강제, trailing whitespace 제거

### IntelliJ 연동 (선택)

1. `Plugins → Marketplace` 에서 **google-java-format** 설치 후 재시작
2. `Settings → Other Settings → google-java-format Settings` → Enable 체크, **Code style: AOSP**
3. `Help → Edit Custom VM Options...` 에 JDK 16+ 용 `--add-exports` 옵션 6줄 추가 후 **IntelliJ 완전 재시작**
   ```
   --add-exports=jdk.compiler/com.sun.tools.javac.api=ALL-UNNAMED
   --add-exports=jdk.compiler/com.sun.tools.javac.code=ALL-UNNAMED
   --add-exports=jdk.compiler/com.sun.tools.javac.file=ALL-UNNAMED
   --add-exports=jdk.compiler/com.sun.tools.javac.parser=ALL-UNNAMED
   --add-exports=jdk.compiler/com.sun.tools.javac.tree=ALL-UNNAMED
   --add-exports=jdk.compiler/com.sun.tools.javac.util=ALL-UNNAMED
   ```
   ⚠️ 반드시 **`=` 포함 형식**으로 작성할 것 (공백 구분자는 JVM은 인식해도 플러그인 감지 로직이 못 잡아서 "Configure the JRE" 알림이 계속 뜸)
4. `Settings → Tools → Actions on Save` → **Reformat code (Whole file)** + **Optimize imports** 체크

이렇게 하면 커밋 전 `spotlessApply` 를 매번 돌리지 않아도 된다.

## 11. API 문서 (Springdoc OpenAPI)

Swagger UI 가 `/swagger-ui.html` 에 자동 생성된다. 컨트롤러/DTO 만 제대로 작성해도 기본 문서는 나오지만, 프론트·기획자 가독성을 위해 어노테이션으로 설명을 추가한다.

### 권장 어노테이션

```java
@Operation(summary = "회원가입", description = "이메일과 닉네임으로 신규 회원을 등록한다")
@ApiResponse(responseCode = "201", description = "가입 성공")
@ApiResponse(responseCode = "409", description = "이메일/닉네임 중복")
@PostMapping
public ResponseEntity<ApiResponse<UserResponse>> signup(@Valid @RequestBody UserSignupRequest request) { ... }
```

DTO 필드에도 설명 추가 가능:
```java
public record UserSignupRequest(
        @Schema(description = "이메일 주소", example = "test@comong.com")
        @NotBlank @Email String email,
        ...
) { }
```

### 프로파일별 활성화

| 프로파일 | Swagger UI | OpenAPI JSON |
| --- | --- | --- |
| `local` / `dev` | ✅ 활성 | ✅ 활성 |
| `prod` | ❌ 차단 | ❌ 차단 |

`application-prod.yaml` 에서 `springdoc.*.enabled: false` 로 강제.
운영 환경에 API 스펙을 외부 노출하지 않기 위함. 필요시 (파트너 공개 등) 팀 논의 후 해제.

## 12. 인증 / 인가

### 방식

- **Stateless JWT** 기반. 세션/쿠키/CSRF/formLogin/httpBasic 모두 비활성.
- `Authorization: Bearer <access_token>` 헤더로 인증.
- 필터: `JwtAuthenticationFilter` 가 `UsernamePasswordAuthenticationFilter` 앞에서 토큰 검증.

### 공개 엔드포인트

`SecurityConfig.PUBLIC_ENDPOINTS` 에 정의. 변경 시 팀 리뷰 필수.

- `POST /users` (회원가입)
- `/auth/**` (로그인 등)
- `/actuator/health`
- `/v3/api-docs/**`, `/swagger-ui.html`, `/swagger-ui/**`

그 외 모든 엔드포인트는 **인증 필요**.

### 실패 응답

| 상황 | 상태 | 코드 |
| --- | --- | --- |
| 토큰 없음 / 유효하지 않음 | 401 | `G-003` |
| 인가 실패 (권한 부족) | 403 | `G-004` |
| 로그인 자격증명 불일치 | 401 | `A-001` |
| 토큰 만료 | 401 | `A-002` |

→ `RestAuthenticationEntryPoint` / `RestAccessDeniedHandler` 가 `ApiResponse` 포맷으로 변환.

### 비밀번호

- 저장은 **BCrypt 해시**만 (`PasswordEncoder` 빈 사용). 평문 저장 금지.
- DTO 검증: 영문/숫자/특수문자 각 1개 이상, 8~64자.

### JWT 설정

`application.yaml` → `security.jwt.*` 로 바인딩 (`JwtProperties`).

| 키 | 설명 | 기본값 |
| --- | --- | --- |
| `security.jwt.secret` | HS256 서명 키 (32자 이상) | 로컬 기본값 존재, **운영은 반드시 `JWT_SECRET` 환경변수** |
| `security.jwt.access-token-ttl-seconds` | Access 토큰 유효시간 | 3600 (1시간) |
| `security.jwt.issuer` | 발급자 (iss) | `comong` |

### Swagger 연동

- `OpenApiConfig` 에 Bearer 스키마 등록 완료.
- Swagger UI 우측 상단 **Authorize** 버튼 → 발급받은 토큰 입력 → 보호된 엔드포인트 호출 가능.

### 인증된 사용자 조회

컨트롤러/서비스에서 현재 사용자 필요 시:

```java
JwtTokenProvider.AuthenticatedUser user =
        (JwtTokenProvider.AuthenticatedUser) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
Long userId = user.userId();
```

(추후 `@AuthenticationPrincipal` 용 커스텀 어노테이션 검토 — 새 이슈)

## 13. 커밋 메시지

```
[S14P31E103-<이슈번호>] BE/<타입>: <내용>
```

- 타입: `init`, `feat`, `fix`, `refactor`, `test`, `docs`, `chore` 등
- 한 커밋은 한 관심사. 공통 설정과 도메인 기능을 섞지 말 것
