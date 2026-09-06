# 데이터 수집기 (docs/SPEC.md Phase 10-3)

Python 스크립트. Node/Next.js 앱과는 독립적으로 실행되며, 같은 Supabase
Postgres(`DATABASE_URL`)에 직접 upsert합니다.

## 설치

```bash
cd scripts/collector
pip install -r requirements.txt
```

`DATABASE_URL`은 저장소 루트의 `.env.local`에서 자동으로 읽습니다(Node 앱과
동일한 파일). 별도 환경에서 실행한다면 `DATABASE_URL` 환경변수를 직접
설정하십시오.

## 실행 순서

```bash
python master.py                                  # 종목 마스터 갱신 (먼저 실행)
python backfill.py --start 2022-01-01 --end 2026-01-01   # 최초 1회, 기간 지정
python daily.py                                    # 이후 매일 증분 (cron)
```

## 중요한 제약 (실제로 검증함)

- **전종목 일괄 조회(불라 by-date) API는 이 환경에서 KRX 로그인 없이는
  동작하지 않습니다** (pykrx, FinanceDataReader 둘 다 확인). 그래서 이
  수집기는 스펙이 이미 전제하고 있던 방식대로 **종목별로 하나씩 순회하며
  요청 간 0.3초 대기 + 실패 시 3회 재시도**하는 구조로 되어 있습니다.
- 종목 마스터(전체 목록)는 `FinanceDataReader.StockListing('KRX-DESC')`로
  로그인 없이 가져올 수 있습니다(검증 완료, 2,873개 종목 확인).
- 개별 종목의 일봉(OHLCV)은 `FinanceDataReader.DataReader(code, start, end)`로
  로그인 없이 가져올 수 있습니다(검증 완료, pykrx 결과와 수치 일치 확인).
- **투자자 수급(외국인/기관/개인 순매수)은 이 환경에서 KRX_ID/KRX_PW
  로그인 없이는 항상 빈 결과를 반환했습니다.** `KRX_ID`/`KRX_PW`
  환경변수(무료 KRX 정보데이터시스템 회원가입)가 설정되어 있을 때만
  수집을 시도하며, 없으면 조용히 건너뜁니다 — OHLCV 수집은 이 자격 증명
  없이도 완전히 동작합니다. (이 자격 증명을 갖고 있지 않아 투자자 수급
  수집 경로 자체는 실제 로그인으로 검증하지 못했습니다.)
- 상장폐지 감지는 근사치입니다: 어제까지 `ticker_master`에 있던 종목이
  오늘자 활성 목록에서 사라지면 그 날짜로 `delisted_at`을 채웁니다(정확한
  상장폐지일이 아니라 "수집기가 처음 사라짐을 인지한 날").

## GitHub Actions

`.github/workflows/collector.yml`이 평일 18:00 KST(09:00 UTC)에 `daily.py`를
자동 실행합니다. 저장소 Settings → Secrets에 `DATABASE_URL`(필수),
`KRX_ID`/`KRX_PW`(선택, 투자자 수급용)를 등록해야 합니다.
