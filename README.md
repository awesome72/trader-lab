# TraderLab

개인 트레이더가 **"매매 의사결정의 품질"을 측정하고 훈련하는"** 웹앱입니다.

> 종목 추천, 목표주가 예측, 매매 시그널은 절대 제공하지 않습니다. 이 프로젝트는 교육/훈련 도구이며, 투자자문이 아닙니다.

전체 설계 배경과 12주 로드맵은 [`docs/SPEC.md`](docs/SPEC.md)에, AI 코딩 규칙은 [`CLAUDE.md`](CLAUDE.md)에 있습니다. 이 README는 "지금 이 저장소를 어떻게 실행하고 어디까지 진행됐는지"를 다룹니다.

## 왜 이 앱인가

개인 투자자가 지는 이유는 "좋은 종목을 못 찾아서"가 아니라 과잉거래, 처분효과(이익은 빨리 팔고 손실은 오래 쥐는 것), 결과 편향(운을 실력으로 착각), 과신(캘리브레이션 실패) 때문이라는 것이 반복적으로 확인된 실증 연구 결과입니다. 트레이딩은 "노이즈가 큰 저빈도 피드백 환경"이라 자연 학습이 잘 작동하지 않습니다. TraderLab은 아래 4가지 교육 원리로 인위적인 피드백 루프를 만듭니다.

1. **결과가 아닌 프로세스를 채점** — 프로세스 점수(`processScore`)와 결과(`realizedR`)를 완전히 분리해 2×2(`quadrant`)로 나눕니다. 가장 위험한 칸은 "나쁜 프로세스 + 좋은 결과"(운)입니다.
2. **사전 확약 → 사후 대조** — 진입 전에 무효화 조건·손절가·목표가를 잠그고, 청산 후 자동으로 대조합니다. 저장된 저널은 수정할 수 없고 append-only 코멘트만 허용됩니다.
3. **압축된 반복 훈련** — 종목명·날짜를 가린 블라인드 바 리플레이로 실전 1년치 상황을 며칠에 압축 경험합니다.
4. **정량화된 자기 인식** — "조급한 것 같다"를 "09:00~09:30 진입 시 승률 31%, 그 외 54%" 같은 숫자로 바꿉니다.

## 기술 스택

| 레이어 | 선택 |
|---|---|
| 프레임워크 | Next.js 15 (App Router) + TypeScript (strict) |
| 스타일 | Tailwind CSS v4 + shadcn/ui |
| DB / 인증 | Supabase (Postgres, Auth, Row Level Security) |
| ORM | Drizzle ORM (+ drizzle-kit 마이그레이션) |
| 차트 | lightweight-charts(가격), Recharts(통계) — 예정 |
| 상태 | Zustand(로컬 UI), TanStack Query(서버) — 예정 |
| 테스트 | Vitest |

스택은 `CLAUDE.md`에 고정되어 있으며 임의로 바꾸지 않습니다.

## 아키텍처 원칙 (요약)

전체 규칙은 `CLAUDE.md` 참조. 핵심만 요약하면:

- **모든 도메인 계산은 `lib/domain/`의 순수 함수로 작성합니다.** DB·fetch·React·`Date.now()`·`Math.random()`을 참조하지 않고, 현재 시각이 필요하면 인자로 주입받습니다. 이 폴더의 모든 export 함수는 같은 이름의 `.test.ts`를 가집니다.
- **React 컴포넌트에는 비즈니스 계산 로직을 넣지 않습니다.** 계산은 항상 `lib/domain`을 호출합니다.
- **DB 접근은 Server Component / Server Action / Route Handler에서만.** 클라이언트 컴포넌트에서 직접 접근하지 않습니다.
- **RLS는 모든 사용자 테이블에 필수.** 단, Drizzle(`lib/db/index.ts`)은 `DATABASE_URL`로 직접 연결하므로 Postgres의 `auth.uid()`가 채워지지 않습니다 — 즉 RLS가 Drizzle 쿼리를 자동으로 좁혀주지 않습니다. 그래서 Drizzle로 쓰는 모든 쿼리는 `supabase.auth.getUser()`로 얻은 사용자 id로 **명시적으로** 필터링해야 합니다(예: `app/settings/actions.ts`). RLS는 향후 supabase-js 클라이언트 경로에 대한 방어선(defense in depth)입니다.
- **서버 전용 키(`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `KIS_APP_SECRET`)는 `NEXT_PUBLIC_` 접두사를 절대 붙이지 않습니다.**
- **저널은 append-only.** 저장 후 핵심 필드(논거/무효화조건/손절가/목표가/확신도) 수정 불가, 이후 변경은 `trade_events`에만 추가.
- **금액·가격·수량 비교/집계 시 `lib/domain/money.ts`의 `round()`를 사용**해 부동소수 오차를 방지합니다.

## 프로젝트 구조

```
trader-lab/
├── CLAUDE.md                 # AI 코딩 규칙
├── docs/
│   └── SPEC.md                # 전체 설계 문서 (Phase별 프롬프트 포함)
├── app/
│   ├── (auth)/login/           # 매직 링크 로그인
│   ├── auth/callback/          # OAuth/매직링크 콜백 (PKCE code exchange)
│   ├── settings/                # 계좌 규모 · 리스크 · 수수료/세금/슬리피지 설정
│   └── page.tsx
├── lib/
│   ├── domain/                 # 순수 함수 (전부 .test.ts 보유)
│   │   ├── types.ts             # Trade / TradeEvent / ProfileSettings
│   │   ├── money.ts              # 부동소수 안전 round()
│   │   ├── r-multiple.ts         # R-multiple, 포지션 사이징, 비용 반영
│   │   ├── process-score.ts      # 프로세스 점수 + skill/luck/badluck/mistake
│   │   ├── metrics.ts             # 기대값, SQN, Kelly, 부트스트랩 신뢰구간
│   │   ├── bias-metrics.ts        # 처분효과/보복매매/과잉거래/물타기/FOMO 레이더
│   │   ├── calibration.ts         # Brier Score, ECE
│   │   └── monte-carlo.ts         # 시드 기반 몬테카를로 리스크 시뮬레이션
│   ├── db/
│   │   ├── schema.ts             # Drizzle 스키마 (14 테이블)
│   │   └── index.ts               # Drizzle 클라이언트 (서버 전용)
│   └── supabase/
│       ├── client.ts, server.ts, middleware.ts
├── drizzle/migrations/         # 스키마 + RLS/트리거 마이그레이션
├── middleware.ts                # 세션 갱신 + 보호 라우트
└── components/ui/               # shadcn/ui 컴포넌트
```

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. Supabase 프로젝트 연결

이미 프로젝트가 있다면 [Supabase 대시보드](https://supabase.com/dashboard) → **Project Settings → API / Database**에서 아래 값을 확인하세요. 없다면 새로 만든 뒤 동일하게 진행합니다.

`.env.example`을 복사해 `.env.local`을 만들고 값을 채웁니다(이 파일은 git에 커밋되지 않습니다):

```bash
cp .env.example .env.local
```

| 변수 | 위치 | 비고 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API Keys | publishable/anon 키 (브라우저 노출 가능) |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API Keys | **서버 전용.** secret/service_role 키 |
| `DATABASE_URL` | Project Settings → Database → Connect → ORM → Drizzle | 비밀번호의 특수문자는 URL 인코딩 필요(예: `@` → `%40`) |

또한 Supabase 대시보드 **Authentication → URL Configuration → Redirect URLs**에 아래를 추가해야 매직 링크 로그인이 동작합니다:

```
http://localhost:3000/auth/callback
http://localhost:3000/**
```

### 3. DB 마이그레이션 적용

```bash
npm run db:migrate
```

스키마를 수정한 뒤에는 `npm run db:generate`로 새 마이그레이션 SQL을 생성하고, 검토 후 `npm run db:migrate`로 적용합니다. RLS 정책이나 트리거처럼 스키마 파일로 표현되지 않는 변경은 `drizzle-kit generate --custom`으로 빈 마이그레이션을 만들고 SQL을 직접 작성합니다(`drizzle/migrations/0001_rls_and_profile_trigger.sql` 참고).

### 4. 개발 서버 실행

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) 접속 시 로그인하지 않은 요청은 `/login`으로 리다이렉트됩니다.

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 (타입체크 + lint 포함) |
| `npm run start` | 프로덕션 서버 실행 |
| `npm run lint` | ESLint |
| `npm run test` | Vitest 전체 실행 (1회) |
| `npm run test:watch` | Vitest watch 모드 |
| `npm run db:generate` | 스키마 변경분으로 마이그레이션 SQL 생성 |
| `npm run db:migrate` | 대기 중인 마이그레이션을 DB에 적용 |

## 도메인 용어

코드에서 아래 이름을 그대로 사용합니다 (상세 산식은 `lib/domain/` 참조):

- **`R` (R-multiple)**: 1R = 진입 시 감수하기로 한 손실액. `realizedR = (exitPrice - entryPrice) / (entryPrice - stopPrice)`(long 기준)
- **`plannedR`**: 진입 시점의 목표 손익비
- **`processScore`**: 0~100. 결과와 완전히 독립적인 프로세스 점수
- **`quadrant`**: `'skill' | 'luck' | 'badluck' | 'mistake'`
- **`MAE` / `MFE`**: 보유 중 최대 역행폭 / 최대 순행폭 (R 단위)
- **`invalidation`**: 진입 시 선언한 "내가 틀렸음을 알 수 있는 조건"
- **`expectancy`**: `winRate * avgWinR - lossRate * avgLossR`
- **`source`**: `'live' | 'replay' | 'drill'` — 실전/리플레이/드릴 데이터는 섞지 않음

## 진행 상황

`docs/SPEC.md` PART E의 Phase 순서를 따라 한 번에 한 Phase씩 진행합니다.

- [x] **Phase 0** — 프로젝트 스캐폴딩 (Next.js 15 + TS + Tailwind + shadcn/ui)
- [x] **Phase 1** — `lib/domain/` 순수 함수 8개 모듈 + Vitest 테스트 81개
- [x] **Phase 2** — Supabase 연결, Drizzle 스키마/마이그레이션, RLS, 매직 링크 인증, 설정 페이지
- [x] **Phase 3** — M1 의사결정 저널 (진입 폼, 잠금 규칙, 청산 대조 화면)
- [ ] **Phase 4** — M2 프로세스 스코어카드 + M3 R-멀티플 대시보드
- [ ] **Phase 5** — M4 행동 편향 탐지기 + M6 반사실 시뮬레이터
- [ ] **Phase 6** — M7 블라인드 바 리플레이
- [ ] **Phase 7** — M9 노코드 룰 백테스터
- [ ] **Phase 8** — M10 AI 소크라테스 코치
- [ ] **Phase 9** — M5 캘리브레이션 · M8 드릴 · M11 SRS · M12 몬테카를로 리스크랩
- [ ] **Phase 10** — 통합 · 온보딩 · 데이터 수집기

## 만들지 않는 것 (Anti-goals)

- 종목 추천 / 매수 시그널 알림, AI 목표주가 예측, 시황 단정 생성
- 수익률 기준 사용자 랭킹/리더보드 (프로세스 점수 랭킹은 허용)
- 저장된 진입 저널의 사후 수정 기능 (append-only만 허용)
- 백테스트/리플레이에서 미래 데이터를 클라이언트로 전송 (look-ahead 금지)
- 표본 30건 미만에서 단정적 성과 문구 표시 (반드시 신뢰구간 병기)

## 고지

본 서비스는 투자 교육 및 자기 훈련 도구이며, 투자자문·투자권유가 아닙니다. 모든 투자 판단과 그 결과는 이용자 본인에게 귀속됩니다.
