# NNP 개발환경 프레임워크

## 📋 개요

**NNP (NestJS + Next.js + Prisma) 개발환경 프레임워크**는 The Root Lab에서 개발한 풀스택 웹 애플리케이션 개발을 위한 오리지널 소스 프레임워크입니다.

이 프레임워크는 현대적인 웹 애플리케이션 개발에 필요한 모든 구성 요소를 포함하고 있으며, 백엔드와 프론트엔드가 통합된 개발 환경을 제공합니다.

### 🎯 주요 특징

- **통합 개발 환경**: 백엔드와 프론트엔드가 하나의 저장소에서 관리
- **타입 안전성**: TypeScript 기반의 엔드투엔드 타입 안전성 보장
- **OpenAPI 통합**: 자동 생성된 API 클라이언트로 타입 안전한 API 통신
- **모듈화 구조**: 확장 가능하고 유지보수가 용이한 모듈 기반 아키텍처
- **프로덕션 준비**: Docker, 보안, 인증 등 프로덕션 환경을 위한 기능 내장

---

## 🏗️ 프레임워크 아키텍처

### 기술 스택

- **Backend**: NestJS (Node.js), TypeScript, Prisma ORM
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Database**: PostgreSQL
- **Authentication**: NextAuth.js, JWT
- **API Documentation**: Swagger/OpenAPI
- **UI Components**: Radix UI, Lucide React

### 프레임워크 구조

```
NNP.DEV.OPS/
├── backend/          # NestJS API 서버
│   ├── src/
│   │   ├── auth/     # 인증/권한 관리 모듈
│   │   ├── user/     # 사용자 관리 모듈
│   │   ├── dept/     # 부서 관리 모듈
│   │   ├── approval/ # 전자결재 모듈
│   │   ├── project/  # 프로젝트 관리 모듈
│   │   ├── board/    # 게시판 모듈
│   │   └── ...
│   └── prisma/       # 데이터베이스 스키마
├── frontend/         # Next.js 웹 애플리케이션
│   ├── app/          # 페이지 라우팅
│   ├── components/   # 재사용 가능한 컴포넌트
│   └── lib/          # 유틸리티 함수
└── docker-compose.yml # 컨테이너 오케스트레이션
```

---

## 📚 소스 코드 구조

### Backend 모듈 구조 (NestJS)

```
backend/src/
├── auth/                # 인증/인가 모듈
├── user/                # 사용자 모듈
├── dept/                # 부서 모듈
├── pos/                 # 직급 모듈
├── duty/                # 직책 모듈
├── approval/            # 전자결재 모듈
├── project/             # 프로젝트 모듈
├── buyer/               # 거래처 모듈
├── board/               # 게시판 모듈
├── litigation/          # 송무(소송) 관리 모듈
│   ├── dto/
│   ├── litigation.controller.ts
│   └── litigation.service.ts
└── ...
```

### Frontend 앱 구조 (Next.js App Router)

```
frontend/app/
├── page.tsx                     # 홈/대시보드
├── dash/                        # 대시보드
├── user/, user-admin/           # 사용자/관리자
├── dept/, pos/, duty/           # 조직 관리
├── approval/, approval-admin/   # 전자결재
├── project/, project-admin/     # 프로젝트
├── buyer/                       # 거래처
├── board(community)/           # 커뮤니티/게시판
├── liti/case-mng/              # 송무 사건 관리
│   ├── page.tsx                 # 목록 페이지
│   ├── ui.tsx                   # 목록 UI + 모달 관리
│   └── _components/
│       ├── create.dialog.tsx    # 사건 등록 다이얼로그
│       └── update.dialog.tsx    # 사건 수정 다이얼로그
└── ...

frontend/components/             # UI 컴포넌트(shadcn)
frontend/lib/api/                # 서버 액션/API 래퍼 (OpenAPI client 사용)
frontend/generated/openapi-client# OpenAPI 코드 생성물
```

---

## 🔐 인증 및 권한 관리

### 인증 시스템

- **NextAuth.js** 기반 세션 관리
- **JWT 토큰** 기반 API 인증
- **bcryptjs**를 통한 비밀번호 암호화
- **OAuth** 지원 (Google, GitHub 등)

### 권한 관리

- **메뉴 기반 권한 제어**: 사용자별 접근 가능한 메뉴 관리
- **관리자 권한**: 시스템 전체 관리 권한
- **부서별 권한**: 부서 단위 데이터 접근 제어
- **역할 기반 접근 제어**: 직급/직책에 따른 권한 차등

### 보안 기능

- **Rate Limiting**: API 호출 제한
- **Helmet**: 보안 헤더 설정
- **HPP**: HTTP Parameter Pollution 방지
- **CORS**: Cross-Origin 요청 제어

---

## 🛠️ 개발 환경 설정

### 필수 요구사항

- Node.js 18 이상
- pnpm (권장) 또는 npm
- PostgreSQL
- Docker (선택사항)

### 설치 및 실행

```bash
# Backend 설정
cd backend
pnpm install
pnpm run start:dev

# Frontend 설정
cd frontend
pnpm install
pnpm run dev
```

### 데이터베이스 설정

```bash
# Prisma 마이그레이션
cd backend
npx prisma migrate dev
npx prisma generate
npx prisma db seed
```

### Docker 배포

```bash
# 전체 시스템 실행
docker-compose up -d
```

### OpenAPI 코드 생성

백엔드 Swagger 스키마 변경 후 프론트엔드 클라이언트를 재생성합니다.

```bash
# 루트에서 실행 (openapi-ts.config.ts 사용)
npx openapi-typescript-codegen --config openapi-ts.config.ts
```

생성물은 `frontend/generated/openapi-client`에 반영되며, 프론트엔드는 해당 타입/클라이언트를 사용합니다.

---

## 📚 API 문서

### Swagger UI

- **개발 환경**: `http://localhost:3001/api`
- **운영 환경**: 설정에 따라 변경

### 주요 API 그룹

- **인증**: `/auth/*`
- **사용자**: `/user/*`
- **조직**: `/dept/*`, `/pos/*`, `/duty/*`
- **전자결재**: `/approval/*`
- **프로젝트**: `/project/*`
- **거래처**: `/buyer/*`
- **게시판**: `/board/*`

---

## 🔒 보안 및 규정 준수

### 데이터 보안

- **암호화**: 비밀번호, 개인정보 암호화 저장
- **접근 제어**: 역할 기반 접근 제어 (RBAC)
- **감사 로그**: 모든 시스템 활동 기록
- **백업**: 정기적 데이터 백업 및 복구

### 개인정보 보호

- **최소 수집**: 업무에 필요한 최소한의 정보만 수집
- **보관 기간**: 법정 보관 기간 준수
- **삭제 정책**: 퇴사자 정보 정기 삭제
- **접근 권한**: 개인정보 접근 권한 최소화

---

## 📈 프레임워크 활용

이 프레임워크는 다양한 비즈니스 도메인에 적용할 수 있도록 설계되었습니다:

- **조직 관리**: 부서, 직급, 직책, 사용자 관리
- **전자결재**: 결재 프로세스 및 문서 관리
- **프로젝트 관리**: 프로젝트 및 업무 관리
- **거래처 관리**: 거래처 및 계약 관리
- **커뮤니케이션**: 게시판 및 문서 발급
- **송무 관리**: 법무 사건 관리

각 모듈은 독립적으로 확장 가능하며, 새로운 비즈니스 로직을 추가하기 쉽도록 구조화되어 있습니다.

---

## 📞 소유주 및 라이선스

**소유주**: The Root Lab

이 프레임워크는 The Root Lab의 오리지널 소스이며, 개발 환경 구축 및 웹 애플리케이션 개발을 위한 기반 프레임워크입니다.

---

_이 문서는 NNP 개발환경 프레임워크의 전반적인 이해를 돕기 위해 작성되었습니다. 더 자세한 정보가 필요하시면 각 모듈별 소스 코드를 참조하시기 바랍니다._
