# 보안 설정 가이드

이 문서는 NARA Groupware 백엔드의 보안 설정에 대해 설명합니다.

## 구현된 보안 기능

### 1. Morgan 로깅

- **목적**: HTTP 요청/응답 로깅
- **설정**: `combined` 포맷 사용
- **제외 항목**: `/docs`, `/favicon.ico`, `/health` 경로

### 2. HPP (Hidden HTTP Parameter Pollution) 보호

- **목적**: HTTP 파라미터 오염 공격 방지
- **기능**: 중복된 파라미터 제거 및 검증

### 3. Helmet 보안 헤더

- **Content Security Policy (CSP)**: XSS 공격 방지
- **HSTS**: HTTPS 강제 사용
- **X-Frame-Options**: 클릭재킹 방지
- **X-Content-Type-Options**: MIME 타입 스니핑 방지

### 4. Rate Limiting

- **기본 설정**: 15분당 100회 요청 제한
- **환경 변수**: `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`

### 5. CORS 보안 강화

- **Origin 검증**: 허용된 도메인만 접근 가능
- **메서드 제한**: GET, POST, PUT, DELETE, PATCH, OPTIONS만 허용
- **헤더 제한**: 필요한 헤더만 허용

### 6. 커스텀 보안 미들웨어

- **SQL Injection 방지**: SQL 패턴 검사
- **XSS 방지**: 스크립트 태그 및 이벤트 핸들러 검사
- **요청 크기 제한**: 10MB 제한
- **User-Agent 검증**: 비정상적인 User-Agent 차단

### 7. 전역 예외 처리

- **에러 로깅**: 모든 에러를 로그에 기록
- **프로덕션 보안**: 상세한 에러 정보 숨김
- **구조화된 응답**: 일관된 에러 응답 형식

## 환경 변수 설정

```bash
# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15분 (밀리초)
RATE_LIMIT_MAX_REQUESTS=100  # 최대 요청 수

# CORS
CORS_ORIGINS=http://localhost:3000,https://localhost:3000

# 로깅
LOG_LEVEL=info
```

## 보안 모니터링

### 로그 확인

```bash
# Morgan 로그 확인
tail -f logs/access.log

# 에러 로그 확인
tail -f logs/error.log
```

### 보안 이벤트 모니터링

- SQL Injection 시도
- XSS 공격 시도
- Rate Limit 초과
- CORS 위반
- 비정상적인 User-Agent

## 추가 보안 권장사항

### 1. 환경 변수 보안

- `.env` 파일을 `.gitignore`에 추가
- 프로덕션 환경에서 강력한 비밀번호 사용
- 정기적인 비밀번호 변경

### 2. 데이터베이스 보안

- Prisma 스키마에서 민감한 필드 제외
- 데이터베이스 접근 권한 최소화
- 정기적인 백업 및 암호화

### 3. API 보안

- JWT 토큰 만료 시간 단축
- 민감한 API 엔드포인트에 추가 인증
- API 버전 관리

### 4. 서버 보안

- HTTPS 강제 사용
- 정기적인 보안 업데이트
- 방화벽 설정

## 문제 해결

### CORS 오류

```javascript
// 허용된 Origin 확인
console.log(securityConfig.cors.origin);
```

### Rate Limit 오류

```javascript
// Rate Limit 설정 확인
console.log(securityConfig.rateLimit);
```

### 보안 미들웨어 오류

```javascript
// 로그에서 보안 이벤트 확인
grep "Suspicious" logs/error.log
```

## 업데이트 이력

- **2024-01-XX**: 초기 보안 설정 구현
  - Morgan 로깅 추가
  - HPP 보호 추가
  - Helmet 보안 헤더 설정
  - Rate Limiting 구현
  - 커스텀 보안 미들웨어 추가
