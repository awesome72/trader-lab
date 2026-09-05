# 프로젝트: TraderLab

개인 트레이더가 "매매 의사결정의 품질"을 측정·훈련하는 웹앱.
종목 추천이나 매매 시그널은 절대 제공하지 않는다. 교육/훈련 도구다.

## 기술 스택 (변경 금지)
- Next.js 15 App Router + TypeScript (strict)
- Tailwind CSS + shadcn/ui
- Supabase (Postgres, Auth, RLS) + Drizzle ORM
- 차트: lightweight-charts(가격), Recharts(통계)
- 상태: Zustand(로컬 UI), TanStack Query(서버)
- 테스트: Vitest

## 아키텍처 불변 규칙
1. 모든 도메인 계산은 `lib/domain/` 아래 **순수 함수**로 작성한다.
   DB, fetch, React, `Date.now()`를 절대 참조하지 않는다.
   현재 시각이 필요하면 인자로 주입받는다.
2. `lib/domain/`의 모든 export 함수는 같은 이름의 `.test.ts`를 반드시 가진다.
3. React 컴포넌트에 비즈니스 계산 로직을 넣지 않는다. 계산은 `lib/domain` 호출.
4. DB 접근은 Server Component 또는 Route Handler에서만. 클라이언트 컴포넌트 금지.
5. Supabase 모든 사용자 테이블에 RLS를 켜고 `auth.uid() = user_id` 정책을 적용한다.
6. 외부 API 키(`ANTHROPIC_API_KEY`, `KIS_APP_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`)는
   서버 전용이다. `NEXT_PUBLIC_` 접두사를 절대 붙이지 않는다.
7. 금액·가격·수량은 number로 다루되, 비교/집계 시 부동소수 오차를 고려해
   `lib/domain/money.ts`의 round 유틸을 사용한다.

## 도메인 용어 (코드에서 이 이름 그대로 사용)
- `R` (R-multiple): 1R = 진입 시 감수하기로 한 손실액.
  `realizedR = (exitPrice - entryPrice) / (entryPrice - stopPrice)` (long 기준)
- `plannedR`: 진입 시점의 목표 손익비
- `processScore`: 0~100. **결과와 완전히 독립적인** 프로세스 점수
- `quadrant`: `'skill' | 'luck' | 'badluck' | 'mistake'`
- `MAE` / `MFE`: 보유 중 최대 역행폭 / 최대 순행폭 (R 단위)
- `invalidation`: 진입 시 선언한 "내가 틀렸음을 알 수 있는 조건"
- `expectancy`: `winRate * avgWinR - lossRate * avgLossR`
- `source`: `'live' | 'replay' | 'drill'` — 실전/리플레이/드릴 데이터는 섞지 않는다

## 절대 금지 (Anti-goals)
- 종목 추천, 목표주가 예측, 매매 시그널, 시황 단정 생성
- 수익률 기준 사용자 랭킹/리더보드
- 저장된 진입 저널의 사후 수정 기능 (append-only만 허용)
- 백테스트/리플레이에서 미래 데이터를 클라이언트로 전송 (look-ahead 금지)
- 표본 30건 미만에서 단정적 성과 문구 표시 (반드시 신뢰구간 병기)

## 작업 방식
- 한 번에 한 모듈만 수정한다. 요청되지 않은 파일을 리팩터링하지 않는다.
- 새 의존성 추가 전 반드시 이유를 먼저 설명하고 승인을 받는다.
- 스키마 변경은 항상 마이그레이션 파일로 남긴다.
- 작업 완료 후 변경 파일 목록과 수동 확인 방법을 3줄 이내로 요약한다.
- 테스트가 실패하면 통과할 때까지 스스로 수정한다.

## 참조 문서
- `docs/SPEC.md` — 전체 설계 및 Phase별 프롬프트
- `docs/DOMAIN.md` — 도메인 용어 상세 정의
