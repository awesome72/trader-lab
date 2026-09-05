# TraderLab — 개인 트레이더 역량 개발 플랫폼
## 설계 제안서 + 바이브 코딩 프롬프트 팩 (v1.0)

> **한 줄 정의**: "종목을 추천하는 사이트"가 아니라 **"내 매매 의사결정의 품질을 측정하고 훈련시키는 사이트"**.
> 시그널을 파는 순간 이 제품은 리딩방이 되고, 교육 효과는 0이 됩니다. 이 문서 전체는 그 전제 위에 설계되었습니다.

---

# 목차

- [PART A. 설계 철학 — 왜 이 구조인가](#part-a-설계-철학--왜-이-구조인가)
- [PART B. 기능 제안 (12개 모듈, Tier별 상세)](#part-b-기능-제안-12개-모듈-tier별-상세)
- [PART C. 기술 스택 & 데이터 소스](#part-c-기술-스택--데이터-소스)
- [PART D. 데이터 모델 (스키마 전문)](#part-d-데이터-모델-스키마-전문)
- [PART E. 단계별 바이브 코딩 프롬프트 (복붙용)](#part-e-단계별-바이브-코딩-프롬프트-복붙용)
- [PART F. 프롬프트 운용 원칙](#part-f-프롬프트-운용-원칙)
- [PART G. 법적·윤리적 가드레일](#part-g-법적윤리적-가드레일)
- [부록. 12주 실행 로드맵](#부록-12주-실행-로드맵)

---

# PART A. 설계 철학 — 왜 이 구조인가

## A-1. 개인 트레이더가 실패하는 진짜 이유

개인 투자자가 지는 이유는 "좋은 종목을 못 찾아서"가 아닙니다. 실증 연구가 반복적으로 지목하는 원인은 다음 4가지입니다.

| # | 실패 원인 | 학술적 근거 | 이 사이트가 다루는 방식 |
|---|---|---|---|
| 1 | **과잉거래 (Overtrading)** | Barber & Odean (2000) "Trading is Hazardous to Your Wealth" — 거래 빈도 상위 20%가 시장 대비 연 6.5%p 열위 | 거래빈도-수익률 개인 회귀 대시보드 |
| 2 | **처분효과 (Disposition Effect)** | Shefrin & Statman (1985), Odean (1998) — 이익은 빨리 실현, 손실은 오래 보유 | 보유기간 비대칭 지표 자동 산출 |
| 3 | **결과 편향 (Outcome Bias)** | 좋은 결과 = 좋은 판단으로 착각 → 잘못된 학습 | 프로세스/결과 2×2 분리 채점 |
| 4 | **과신 (Overconfidence) / 캘리브레이션 실패** | Prospect Theory (Kahneman & Tversky), Thaler의 Mental Accounting | 확신도 vs 실적중률 Brier Score 훈련 |

> **핵심 통찰**: 트레이딩은 "노이즈가 큰 저빈도 피드백 환경"입니다. 골프나 체스와 달리, 잘못해도 이기고 잘해도 집니다. 그래서 **자연 학습(natural learning)이 작동하지 않습니다.**
> → 인위적으로 **신호 대 잡음비(SNR)를 높인 피드백 루프**를 만들어 주는 것이 이 제품의 존재 이유입니다.

## A-2. 교육 설계의 4대 원리

이 사이트의 모든 기능은 아래 4개 원리 중 최소 하나에 매핑되어야 합니다. 매핑되지 않는 기능은 만들지 마십시오.

### 원리 1 — 결과가 아닌 프로세스를 채점한다 (Process over Outcome)
Annie Duke의 *Thinking in Bets* 프레임. 판단 품질과 결과를 강제로 분리합니다.

```
              결과 좋음        결과 나쁨
프로세스 좋음   ✅ 실력(Skill)   😐 불운(Bad Luck)   ← 여기를 칭찬해야 학습됨
프로세스 나쁨   ⚠️ 행운(Luck)    ❌ 실수(Mistake)   ← 여기를 경고해야 함
```
가장 위험한 칸은 **좌하단(행운)**입니다. 개인 트레이더는 여기서 잘못된 확신을 학습합니다.

### 원리 2 — 사전 확약, 사후 대조 (Pre-commitment & Reconciliation)
진입 **전에** 가설·무효화 조건·목표가를 잠그고, 청산 후 자동 대조합니다.
사후에 서술하는 매매일지는 기억 왜곡(hindsight bias) 때문에 교육 가치가 거의 없습니다.

### 원리 3 — 압축된 반복 훈련 (Deliberate Practice)
실전 1년에 겪을 100번의 상황을, 히스토리컬 리플레이로 하루에 겪게 만듭니다.
**단, 종목명·날짜를 가린 블라인드 모드**여야 합니다. 안 가리면 "삼성전자 2023년 그때"라는 사후 지식이 개입합니다.

### 원리 4 — 정량화된 자기 인식 (Quantified Self-Awareness)
"나 좀 조급한 것 같아"를 → "당신은 09:00~09:30 진입 시 승률 31%, 그 외 시간대 54%"로 바꿉니다.
**감정을 숫자로 번역하는 것**이 행동 교정의 유일한 지렛대입니다.

## A-3. 만들면 안 되는 기능 (Anti-Feature List)

| 만들지 말 것 | 이유 |
|---|---|
| 종목 추천 / 매수 시그널 알림 | 교육 효과 0, 의존 심화, 법적 리스크(PART G) |
| "AI 목표주가 예측" | 정확도 검증 불가, 과신 유발 |
| 수익률 랭킹 리더보드 | 무모한 레버리지 경쟁 유발. 대신 **프로세스 점수 랭킹**은 가능 |
| 리딩방/오픈채팅 연동 | 집단 광기 증폭 |
| 자동매매 실행 | 규제·책임 문제, 학습 목적과 정반대 |

---

# PART B. 기능 제안 (12개 모듈, Tier별 상세)

## 개요 맵

```
Tier 0 (MVP · 4주)        Tier 1 (편향교정 · 4주)      Tier 2 (훈련 · 4주)       Tier 3 (확장)
├─ M1 의사결정 저널        ├─ M4 행동편향 탐지기        ├─ M7 바 리플레이         ├─ M10 AI 소크라테스 코치
├─ M2 프로세스 스코어카드   ├─ M5 캘리브레이션 트레이너   ├─ M8 시나리오 드릴        ├─ M11 간격반복 학습카드
└─ M3 R-멀티플 대시보드    └─ M6 반사실 리플레이        └─ M9 룰 백테스터          └─ M12 몬테카를로 리스크랩
```

---

## ⭐ Tier 0 — 핵심 학습 루프 (MVP)

이 3개만 있어도 제품으로 성립합니다. **여기부터 만드십시오.**

### M1. 의사결정 저널 (Decision Journal / Thesis Card)

**목적**: 진입 전 사고를 강제로 외재화(externalize)하여 사후 대조 가능한 데이터로 만든다.

**핵심 규칙**: 진입 기록은 **체결 시각 이후 30분 내에만 작성 가능**하도록 잠급니다. (사후 합리화 차단)

**입력 필드 상세**:

| 그룹 | 필드 | 형식 | 교육적 의도 |
|---|---|---|---|
| **가설** | 진입 논거 | 텍스트 (최소 50자) | 언어화하지 못하면 논거가 아니다 |
| | 셋업 유형 | 선택: 돌파/눌림목/역추세/실적/수급/이벤트/기타 | 자기 전략 분류 체계 형성 |
| | 시간 지평 | 선택: 스캘핑/데이트레이드/스윙(2~10일)/포지션(1개월+) | 지평 혼동이 손절 실패의 1순위 원인 |
| **무효화** | **무효화 조건** ⭐ | 텍스트 (필수) | "무엇이 보이면 내가 틀린 것인가" — 가장 중요한 필드 |
| | 손절가 | 숫자 (필수) | |
| | 손절 근거 | 선택: 기술적 지지선/변동성(ATR×N)/최대손실액/시간손절 | 임의 손절 방지 |
| **기대** | 목표가 1 / 2 | 숫자 | |
| | 확신도 | 슬라이더 0~100% | 캘리브레이션 훈련의 입력값 (M5) |
| | 예상 R-multiple | 자동계산 = (목표가-진입가)/(진입가-손절가) | 손익비 1.5 미만 경고 |
| **사이징** | 계좌 대비 리스크 % | 숫자 | 2% 초과 시 경고 배너 |
| | 산출된 수량 | 자동계산 | 사이징 공식 체화 |
| **상태** | 감정 태그 | 다중선택: 평온/조급/FOMO/복수심/자신만만/불안/지루함 | M4 편향 탐지의 라벨 데이터 |
| | 직전 매매 결과 | 자동 주입 (이전 거래 손익) | 보복매매 탐지용 |
| | 수면/컨디션 | 1~5 | 상관분석용 (의외로 강한 상관 나옴) |

**UI 요구사항**:
- 원페이지 카드 형식, 필수 필드 미입력 시 저장 불가
- 무효화 조건 필드에는 예시 플레이스홀더 3개 로테이션 표시
  ("종가가 20일선 아래 마감", "거래량 없이 3일 횡보", "실적 발표 후 갭하락")
- 저장 후에는 **수정 불가, append-only 코멘트만 허용** (이게 핵심)

**청산 시 자동 대조 화면**:
```
[진입 시 당신의 예상]          [실제 결과]
목표가 82,000 (+8.2%)    →    실제 청산 79,500 (+4.9%)
손절가 73,000 (-3.0%)    →    최저 도달 74,200
확신도 75%               →    적중
예상 R: 2.7R             →    실현 R: 1.6R
무효화 조건: "20일선 이탈" → 발동 여부: ❌ 미발동
보유 예상: 스윙(2~10일)   →    실제 3일 ✅
```

---

### M2. 프로세스 스코어카드 (Process vs Outcome Matrix)

**목적**: 결과 편향을 구조적으로 차단한다. **이 제품의 가장 차별적인 기능.**

**프로세스 점수 산식 (100점 만점)** — 결과와 완전히 독립:

| 항목 | 배점 | 자동 판정 로직 |
|---|---|---|
| 사전 계획 존재 | 20 | 진입 30분 내 저널 작성 여부 |
| 무효화 조건 명시성 | 15 | 조건이 **검증 가능한 형태**인가 (AI 판정 or 체크박스) |
| 손절 준수 | 25 | 손절가 이탈 후 익일까지 미청산 = 0점 |
| 포지션 사이징 규율 | 15 | 계좌 리스크 2% 이내 |
| 물타기 없음 | 10 | 손실 중 추가매수 = 0점 |
| 계획된 지평 준수 | 10 | 스윙 선언 후 당일 청산 = 0점 |
| 감정 상태 | 5 | FOMO/복수심 태그 시 감점 |

**2×2 시각화**:
- 각 거래를 산점도로: X축 = 프로세스 점수, Y축 = 실현 R-multiple
- 사분면별 색상, 각 점 클릭 → 저널 상세
- **좌상단(나쁜 프로세스 + 좋은 결과) 점들을 빨간 테두리로 강조** + "운이 좋았습니다. 이 패턴은 반복되지 않습니다" 문구

**월간 리포트 지표**:
```
평균 프로세스 점수: 68 → 74 (전월 대비 +6)
'운' 사분면 비중: 22% → 11%  ✅ 개선
'실수' 사분면 비중: 18% → 19%
프로세스 점수와 R의 상관계수: 0.41 (표본 47건)
  → 상관이 0.3 이상이면 "당신의 프로세스는 실제로 작동하고 있습니다"
```

---

### M3. R-멀티플 & 기대값 대시보드

**목적**: 수익률(%)이 아닌 **R(리스크 배수)** 단위로 사고하게 만든다. 프로 트레이더의 기본 언어.

> **R-multiple 정의**: 1R = 진입 시 감수한 손실액. 손절 -3%로 잡고 +9% 익절 = +3R.
> R로 사고하면 종목 가격·계좌 크기와 무관하게 **의사결정 품질만 비교**할 수 있습니다.

**표시 지표 (전부 자동 계산)**:

| 지표 | 산식 | 교육 포인트 |
|---|---|---|
| 승률 | 이익거래 / 전체 | 단독으로는 무의미함을 명시 |
| 평균 승 R / 평균 패 R | | |
| **기대값 (Expectancy)** | `승률 × 평균승R − 패률 × 평균패R` | **이 값이 양수인지가 전부** |
| Profit Factor | 총이익 / 총손실 | 1.5 이상 목표 |
| 최대 연속 손실 | | 심리적 준비용 |
| MDD (최대낙폭) | | |
| SQN (System Quality Number) | `√N × 평균R / 표준편차R` | Van Tharp 지표. 1.6~2.0 = 평균, 2.5+ = 우수 |
| 실효 켈리 비중 | `f* = (bp−q)/b`, 실무는 **f*/4 적용** | 풀 켈리는 파산 위험. 1/4 켈리 권장 근거 설명 |

**시각화**:
1. **R-분포 히스토그램** — 손실 꼬리가 -1R을 넘어가는 막대가 있으면 빨간색 (= 손절 미준수의 증거)
2. **누적 R 곡선** — 잔고 곡선보다 훨씬 정직함
3. **기대값 신뢰구간** — 표본 30건 미만이면 "표본 부족, 통계적 판단 불가" 배너 강제 표시

> 📌 **교육 장치**: 표본이 적을 때 "당신은 승률 70%!" 같은 문구를 절대 띄우지 않습니다. 대신 **부트스트랩 신뢰구간**을 보여줍니다. `승률 70% [95% CI: 45%~88%, n=20]`

---

## 🔍 Tier 1 — 편향 교정 모듈

### M4. 행동 편향 탐지기 (Behavioral Bias Radar)

**목적**: 추상적 편향 개념을 **본인 데이터로 정량 증명**한다.

**탐지 항목 6종 + 산식**:

| 편향 | 산식 | 경고 임계값 |
|---|---|---|
| **처분효과** | `PGR − PLR`<br>PGR = 실현이익건수/(실현이익+미실현이익)<br>PLR = 실현손실건수/(실현손실+미실현손실) | > 0.10 |
| **보복매매** | 손실 청산 후 **60분 내** 신규 진입 비율 | > 15% |
| **과잉거래** | 월 거래횟수 vs 월 수익 R의 회귀 기울기 | 기울기 < 0 |
| **물타기** | 손실 포지션 추가매수 발생률 | > 0 (원칙적 금지) |
| **손절 지연** | 계획 손절가 이탈 후 실제 청산까지 평균 지연 시간 | > 1일 |
| **FOMO 진입** | 당일 +5% 이상 급등 종목 추격매수 비율 & 해당 승률 | 승률 < 전체 평균 |

**시각화**: 6축 레이더 차트 (0=건강, 100=위험) + 각 축 클릭 시 해당 거래 리스트 드릴다운

**교육 텍스트 자동 생성 예시**:
```
⚠️ 처분효과 지수: 0.24 (위험)

당신은 이익 포지션을 평균 2.1일 보유하고, 손실 포지션을 평균 8.7일 보유합니다.
같은 크기의 이익과 손실에 대해, 이익 실현 확률이 손실 실현 확률보다 2.4배 높습니다.

이는 Shefrin & Statman(1985)이 정의한 처분효과의 전형적 패턴이며,
Prospect Theory의 손실 회피(손실의 심리적 고통 ≈ 이익 기쁨의 2~2.5배)로 설명됩니다.

📊 당신의 손실: 이 패턴이 없었다면 최근 6개월 누적 +4.2R이 추가되었을 것으로 추정됩니다.
   (M6 반사실 시뮬레이터에서 확인)

🔧 처방: 다음 10거래 동안 '시간 손절' 규칙을 적용하세요.
   → 진입 후 N일 내 목표 방향 진행 없으면 무조건 청산
```

---

### M5. 캘리브레이션 트레이너 (Confidence Calibration)

**목적**: "확신도 80%"라고 말할 때 실제로 80% 맞는 사람이 되게 한다. 슈퍼포캐스팅 훈련법의 트레이딩 적용.

**작동 방식**:
1. 모든 저널에 확신도(0~100%)를 입력
2. 청산 후 성공/실패 라벨링 (성공 = 목표가 1 도달)
3. 확신도 구간별(10% 버킷) 실제 적중률 집계

**핵심 시각화 — 캘리브레이션 곡선**:
```
실제
적중률
100│                              ╱ ← 완벽 캘리브레이션 (y=x)
   │                        ╱
 75│                  ╱   ●
   │            ╱  ●
 50│      ╱  ●
   │  ● ╱          ● ← 당신 (80% 확신 구간의 실제 적중률 52%)
 25│╱   ●
   └────────────────────────────
    25    50    75   100  선언한 확신도

진단: 고확신 구간에서 심각한 과신 (Overconfidence)
```

**Brier Score**: `BS = (1/N) Σ(예측확률 − 실제결과)²` — 0에 가까울수록 우수, 0.25 = 동전던지기

**게이미피케이션 (건전한 방식)**:
- 수익률이 아닌 **Brier Score 개선**을 배지로 보상
- "캘리브레이션 마스터: 최근 30거래 Brier < 0.18"
- 주간 예측 퀴즈: 실제 종목 없이 익명화된 차트 20개 제시 → 5일 후 상승 확률 예측 → 자동 채점

---

### M6. 반사실 리플레이 (Counterfactual Simulator)

**목적**: "만약 내가 규칙을 지켰다면?"을 **숫자로** 보여준다. 가장 강력한 동기부여 장치.

**시뮬레이션 시나리오 (동시 비교)**:

| 시나리오 | 로직 |
|---|---|
| **실제** | 내가 한 그대로 |
| **손절 100% 준수** | 계획 손절가 터치 시 즉시 청산으로 재계산 |
| **목표가 100% 준수** | 목표가 터치 시 즉시 청산 |
| **물타기 제거** | 추가매수 없었다고 가정 |
| **상위 프로세스 점수만** | 프로세스 70점 이상 거래만 실행했다면 |
| **FOMO 진입 제거** | 감정태그 FOMO 거래 제외 |
| **거래 절반** | 확신도 상위 50%만 실행 |

**출력**: 7개 누적 R 곡선 오버레이 + 요약 테이블

```
시나리오              누적R    MDD    거래수   차이
─────────────────────────────────────────────────
실제                  +3.2R   -8.1R    64      —
손절 준수             +11.7R  -4.2R    64    +8.5R  ⭐
물타기 제거           +7.9R   -5.5R    58    +4.7R
FOMO 제거             +9.1R   -6.0R    49    +5.9R
프로세스 70+ 만       +12.4R  -3.8R    31    +9.2R  ⭐⭐
─────────────────────────────────────────────────
💡 결론: 당신에게 필요한 것은 '더 나은 종목'이 아니라
   '거래 수를 절반으로 줄이고 손절을 지키는 것'입니다. (+9.2R)
```

> ⚠️ **주의**: 반사실 시뮬레이션은 **당시 실제 OHLC 데이터로만** 계산해야 하며, "그때 팔았으면 더 벌었을 텐데" 식의 사후 최적화(look-ahead)는 절대 넣지 마십시오. 사전에 선언된 규칙의 적용 여부만 비교합니다.

---

## 🎯 Tier 2 — 딜리버릿 프랙티스 모듈

### M7. 바 리플레이 시뮬레이터 (Blind Bar Replay)

**목적**: 실전 1년치 상황을 며칠에 압축 경험. 트레이딩 딜리버릿 프랙티스의 핵심.

**필수 설계 조건 (하나라도 빠지면 훈련 가치 상실)**:

| 조건 | 이유 |
|---|---|
| **종목명 완전 마스킹** ("종목 A") | "삼성전자니까 오르겠지" 사전 지식 차단 |
| **날짜 마스킹** (D-120, D-119...) | "코로나 때니까" 차단 |
| **가격 정규화 옵션** (진입일 = 100) | 절대 가격대 편견 차단 |
| **미래 봉 절대 미노출** | 우클릭·개발자도구로도 못 보게 서버에서 스트리밍 |
| **랜덤 시드 저장** | 동일 세션 재현 가능 (복기용) |

**세션 흐름**:
```
1. 세션 시작 → 랜덤 종목/기간 선정 (필터: 시총, 섹터, 변동성 구간 선택 가능)
2. 초기 120봉 표시
3. [다음 봉] 버튼 → 1봉씩 진행 (스페이스바 단축키)
4. 언제든 [매수]/[매도] → M1 저널 축약본 강제 입력 (가설/손절/목표/확신도)
5. 청산 시 즉시 R 산출
6. 세션 종료 → 종목명·날짜 공개 + 그때 무슨 뉴스가 있었는지 표시
7. 리플레이 결과가 M2/M3 대시보드에 '시뮬레이션' 태그로 누적
```

**난이도 커리큘럼 (중요)**:
| 레벨 | 설정 | 학습 목표 |
|---|---|---|
| L1 | 일봉 · 명확한 추세 구간 · 지표 없음 | 추세 인식 |
| L2 | 일봉 · 횡보 포함 · 이동평균 허용 | 가짜 신호 구별 |
| L3 | 일봉 · 급등락 포함 · 거래량 표시 | 수급 읽기 |
| L4 | 60분봉 · 갭 상황 포함 | 단기 대응 |
| L5 | 실제 수급(외인/기관) 데이터 포함 · 시장지수 동시 표시 | 시장 맥락 통합 |

---

### M8. 시나리오 드릴 (Decision Drill Cards)

**목적**: 실전에서 가장 흔한 20가지 딜레마 상황을 반복 노출해 반사 신경화.

**드릴 카드 구조**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[상황 카드 #07 — 손절 직전 반등]

보유: 종목 A, 진입가 대비 -2.6%
계획 손절가: -3.0%
현재 시각: 14:32
직전 15분간 +0.8% 반등 중, 거래량 소폭 증가
시장지수: -0.9% (약세)

당신의 선택은?
  (A) 계획대로 -3.0% 도달 시 손절
  (B) 반등 신호이므로 손절가를 -4.5%로 하향 조정
  (C) 지금 즉시 절반 청산, 나머지는 계획 유지
  (D) 반등 확인, 추가 매수(물타기)

확신도: [____%]
근거: [______________]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**채점 방식**: 정답/오답이 아니라 **"프로세스 정합성 채점"**
- (B)는 거의 항상 감점: 사전 계획의 사후 변경
- (D)는 감점: 리스크 확대
- (A)/(C)는 사전 규칙에 무엇을 선언했느냐에 따라 채점
- 즉, **일관성**을 채점합니다. 같은 카드를 3개월 후 다시 제시해 답변 안정성 측정

**필수 드릴 20종 (한국 시장 특화 포함)**:
1. 손절 직전 반등 · 2. 목표가 1% 앞 정체 · 3. 갭상승 시가 대응 · 4. 갭하락 시가 대응
5. 실적 발표 D-1 보유 여부 · 6. 상한가 근접 · 7. VI(변동성완화장치) 발동 직후
8. 시장 급락 중 개별 강세 · 9. 3연속 손실 후 신규 진입 · 10. 이익 +2R 도달, 추세 지속 중
11. 공시(유상증자) 발생 · 12. 외국인 대량 순매도 전환 · 13. 거래정지 해제일
14. 배당락일 보유 · 15. 지수 선물 급변 · 16. 테마주 초기 급등 추격 여부
17. 물린 종목 반등 시 본전 청산 유혹 · 18. 계좌 신고점 직후 사이징
19. 장 마감 5분 전 미체결 · 20. 휴장 전(연휴 앞) 포지션 유지

---

### M9. 노코드 룰 백테스터 (Rule Articulation Engine)

**목적**: "내 감(感)"을 **검증 가능한 명제**로 변환하게 만든다. 언어화 자체가 교육입니다.

**노코드 룰 빌더 UI**:
```
[진입 조건]  ALL of ▾
  ├ 종가 > 20일 이동평균  ▾
  ├ 거래량 > 20일 평균 거래량 × 1.5  ▾
  └ RSI(14) < 70  ▾

[제외 조건]  ANY of ▾
  └ 시가총액 < 3,000억원  ▾

[청산 조건]
  ├ 손절: ATR(14) × 2  ▾
  ├ 익절: 진입가 × 1.08  ▾
  └ 시간 손절: 10거래일  ▾

[사이징] 계좌의 1.0% 리스크 ▾
[비용] 수수료 0.015% + 세금 0.15% + 슬리피지 0.1% ▾
```

**결과 리포트 (교육적 강조점)**:
- 성과 지표뿐 아니라 **표본 수, 신뢰구간, 최악의 6개월 구간**을 동등 비중으로 표시
- **워크포워드 분할 강제**: In-sample(2015~2021) / Out-of-sample(2022~현재) 자동 분리 표시
- 과최적화 경고: 파라미터 조합을 20회 이상 시도하면
  `⚠️ 20회 탐색 시 우연히 좋은 결과가 나올 확률이 급증합니다 (다중검정 문제). 발견한 규칙을 반드시 미학습 구간에서 검증하세요.`

> 💡 **가장 큰 교육 효과**: 대부분의 사용자는 여기서 **"내 감이 통계적으로는 근거가 없었다"**를 처음 마주합니다. 이 경험 하나가 다른 모든 기능보다 강력합니다.

---

## 🤖 Tier 3 — AI · 지식 확장 모듈

### M10. AI 소크라테스 코치 (Claude API)

**목적**: 답을 주지 않고 **질문으로 사고를 유도**한다. 종목 추천은 절대 금지.

**시스템 프롬프트 설계 원칙**:

```
당신은 트레이딩 코치입니다. 당신의 역할은 다음과 같습니다.

[반드시 하는 것]
- 사용자의 매매 저널을 읽고, 논리적 빈틈을 질문으로 지적
- 데이터에 근거한 패턴 제시 ("최근 12건 중 9건이 오전장 진입, 그 승률은 33%입니다")
- 학술 개념과 사용자 행동의 연결 (처분효과, 앵커링, 확증편향 등)
- 다음 10거래에 적용할 구체적 실험 1가지 제안

[절대 하지 않는 것]
- 특정 종목의 매수/매도/보유 권유
- 목표주가나 가격 예측
- "지금 시장은 상승장입니다" 같은 시황 단정
- 사용자를 위로하기 위한 근거 없는 낙관

[질문 예시 톤]
"손절가를 두 번 하향 조정하셨습니다. 진입 시 세운 무효화 조건은
 '20일선 이탈'이었는데, 실제로 이탈했음에도 보유하셨습니다.
 그때 무엇이 판단을 바꾸게 했는지 기억하십니까?"
```

**주요 사용 지점**:
| 지점 | 프롬프트 유형 |
|---|---|
| 진입 저널 저장 직후 | **프리모템(Pre-mortem)**: "3주 후 이 거래가 최악의 손실이 되었다면, 가장 그럴듯한 이유 3가지는?" |
| 청산 직후 | 계획 vs 실제 대조 질문 |
| 주간 리뷰 | 7일치 저널 일괄 분석 → 패턴 3개 + 실험 1개 |
| 월간 리뷰 | 편향 지표 변화 해설 + 다음 달 단일 집중 과제 지정 |
| 드릴 오답 시 | 오답의 사고 과정 되짚기 |

**기술 구현**: `claude-sonnet-4-6` 모델, 저널 데이터를 구조화 JSON으로 컨텍스트 주입, 응답은 JSON 스키마 강제(질문 배열 + 발견 패턴 배열 + 실험 제안 1개)로 파싱해 UI 컴포넌트에 매핑.

---

### M11. 간격 반복 학습 카드 (Spaced Repetition)

**목적**: 개념 지식을 장기 기억화하되, **본인의 실수에서 자동 생성**되게 한다.

**카드 생성 소스 2가지**:
1. **큐레이션 덱** (사전 제작 200장): 시장 미시구조, 리스크 관리, 재무제표, 행동재무학, 한국시장 제도
2. **개인 실수 덱** (자동 생성): 손절 미준수 3회 발생 → 관련 카드 자동 삽입

**개인 실수 카드 예시**:
```
[앞면]
2026-08-14, 당신은 종목 D를 진입하며 손절 -4%를 선언했습니다.
실제로는 -11%에서 청산했습니다. 이때 당신이 스스로에게 한 말은
"조금만 더 기다리면 회복될 것"이었습니다.

이 사고 패턴의 명칭은?

[뒷면]
매몰비용 오류(Sunk Cost Fallacy) + 손실회피(Loss Aversion)의 결합.

Prospect Theory의 가치함수는 손실 영역에서 볼록(convex)합니다.
즉 손실 구간에서는 위험추구적이 됩니다. -4%에서 확실히 손절하는 것보다
"회복 가능성"이라는 도박을 선호하게 되는 이유입니다.

당신의 통계: 손절 지연 거래 11건의 평균 실현 R = -2.7R
             손절 준수 거래 29건의 평균 실현 R = -0.9R
             → 지연 1건당 평균 -1.8R 추가 손실
```

**알고리즘**: SM-2 또는 FSRS. 오답 시 간격 리셋, 정답 시 1→3→7→16→35일.

---

### M12. 몬테카를로 리스크랩

**목적**: "이 정도 사이징이면 얼마나 위험한가"를 직관이 아닌 분포로 이해시킨다.

**입력**: 본인의 실제 R-분포 (M3에서 자동 연동) 또는 가정값
**연산**: 실제 R 분포에서 부트스트랩 복원추출 → 1,000회 × 200거래 시뮬레이션

**출력**:
```
현재 사이징(계좌 2% 리스크) 기준, 200거래 후:

최종 수익 분포:
  5th percentile:  -18%
  25th percentile:  +7%
  중앙값:          +34%
  75th percentile: +71%
  95th percentile: +148%

최대낙폭(MDD) 분포:
  중앙값 MDD:      -19%
  95th percentile: -37%   ← 20번 중 1번은 이만큼 깨집니다

⚠️ 파산 확률(계좌 -50% 도달): 3.2%
⚠️ 10연속 손실 발생 확률: 24%  ← 언젠가 반드시 겪습니다. 미리 각오하십시오.

[사이징 슬라이더로 1% / 2% / 3% / 5% 비교]
  5% 리스크 시 파산 확률: 3.2% → 41%  🔴
```

> 📌 이 화면 하나로 "레버리지 풀로 땡기면 되지 않나"라는 생각이 대부분 사라집니다.

---

## 🇰🇷 한국 시장 특화 부가 모듈 (선택)

| 모듈 | 내용 |
|---|---|
| **수급 리터러시 트레이너** | 외국인/기관/개인 순매수 데이터를 가린 상태로 향후 주가 예측 → 수급 신호의 실제 예측력을 본인 데이터로 체감 |
| **제도 시뮬레이터** | 상하한가 ±30%, VI 발동 조건, 단일가매매, 동시호가 메커니즘을 인터랙티브 설명 |
| **비용 현실화 계산기** | 수수료 + 증권거래세/농특세 + 슬리피지를 R 계산에 강제 반영. "월 20회 회전 시 연간 비용이 원금의 X%" 충격 요법 |
| **공시 판독 훈련** | DART 공시 원문 → 주가 영향 방향 예측 훈련 (유상증자, CB발행, 자사주 등) |

---

# PART C. 기술 스택 & 데이터 소스

## C-1. 권장 스택 (바이브 코딩 최적화 기준)

바이브 코딩에서 스택 선택 기준은 "최고의 기술"이 아니라 **"LLM이 실수 없이 잘 쓰는 기술"**입니다.

| 레이어 | 선택 | 선택 이유 |
|---|---|---|
| 프레임워크 | **Next.js 15 (App Router) + TypeScript** | LLM 학습 데이터 압도적, 풀스택 단일 리포 |
| 스타일 | **Tailwind CSS + shadcn/ui** | 컴포넌트 코드가 리포에 존재 → AI가 직접 수정 가능 |
| DB / 인증 | **Supabase (Postgres + Auth + RLS)** | 무료 티어, SQL 그대로, RLS로 사용자 격리 |
| ORM | **Drizzle ORM** | 타입 안전, 스키마가 TS 파일 = AI가 읽기 쉬움 |
| 차트 | **lightweight-charts (TradingView, Apache-2.0)** | 바 리플레이에 최적, `setData`/`update` API로 봉 단위 스트리밍 |
| 일반 차트 | **Recharts** | R 히스토그램, 레이더, 캘리브레이션 곡선 |
| 상태 | **Zustand + TanStack Query** | 보일러플레이트 최소 |
| 데이터 수집 | **Python: FinanceDataReader, pykrx** | 국내 시세/수급 수집 표준 |
| 실시간·모의투자 | **한국투자증권 KIS Developers OpenAPI** | REST + WebSocket, **모의투자 계좌 지원**이 결정적 |
| AI | **Anthropic Claude API (`claude-sonnet-4-6`)** | 저널 분석·코칭 |
| 배포 | **Vercel + Supabase + (수집기: Railway / GitHub Actions cron)** | |
| 개발 도구 | **Claude Code (주력) + Windsurf (UI 다듬기)** | |

## C-2. 국내 데이터 소스 상세

| 소스 | 취득 데이터 | 비용 | 비고 |
|---|---|---|---|
| **pykrx** | KRX 일봉, 투자자별 순매수(외인/기관/개인), 공매도, 시총, PER/PBR | 무료 | 배치 수집용. 호출 간 `sleep` 필수 |
| **FinanceDataReader** | 국내외 일봉, 종목 마스터, 지수, 환율 | 무료 | 초기 백필에 최적 |
| **KIS Developers** | 실시간 체결/호가(WebSocket), 분봉, 주문/계좌, **모의투자** | 무료(계좌 필요) | 한국투자증권 계좌 개설 → (선택) 상시 모의투자 신청 → KIS Developers 서비스 신청 → App Key / App Secret 발급 순서 |
| **DART Open API** | 공시 원문, 재무제표 | 무료 (API 키) | M11 공시 판독 훈련용 |
| **공공데이터포털** | 금융위 주식시세정보 | 무료 (API 키) | 백업 소스 |

> ⚠️ **네이버/다음 금융 스크래핑은 피하십시오.** 이용약관 위반 소지 + 구조 변경 시 즉시 파손. 프로토타입에서도 pykrx/FDR로 시작하는 편이 결과적으로 빠릅니다.

**데이터 파이프라인 설계**:
```
[GitHub Actions cron 18:00 KST]
   └→ Python collector (pykrx/FDR)
        ├→ ohlcv_daily (upsert)
        ├→ investor_flow (외인/기관/개인 순매수)
        └→ ticker_master (상폐/신규상장 반영)
             ↓
        Supabase Postgres
             ↓
   [Next.js API Route] ← RLS 적용 → [프론트엔드]

[실시간·분봉이 필요할 때만]
   Next.js Route Handler → KIS REST 프록시 (App Secret은 서버에만)
```

**서바이버십 바이어스 방지 (중요)**: 백테스터·리플레이용 종목 유니버스는 **상장폐지된 종목까지 포함**해야 합니다. 현재 상장 종목만 쓰면 백테스트 성과가 구조적으로 과대평가됩니다. `ticker_master`에 `listed_from` / `delisted_at`을 반드시 두십시오.

## C-3. 프로젝트 구조

```
trader-lab/
├── CLAUDE.md                    ← AI 코딩 규칙 (PART E-0에서 생성)
├── docs/
│   ├── SPEC.md                  ← 이 문서
│   └── DOMAIN.md                ← R-multiple, 프로세스점수 등 도메인 용어 정의
├── app/
│   ├── (auth)/
│   ├── journal/                 ← M1
│   ├── scorecard/               ← M2
│   ├── metrics/                 ← M3
│   ├── bias/                    ← M4
│   ├── calibration/             ← M5
│   ├── counterfactual/          ← M6
│   ├── replay/                  ← M7
│   ├── drills/                  ← M8
│   ├── backtest/                ← M9
│   ├── coach/                   ← M10
│   ├── cards/                   ← M11
│   ├── risklab/                 ← M12
│   └── api/
│       ├── ai/coach/route.ts
│       ├── market/[...]/route.ts
│       └── replay/next-bar/route.ts   ← 미래 봉 차단의 핵심
├── lib/
│   ├── domain/                  ← 순수 함수 (테스트 대상)
│   │   ├── r-multiple.ts
│   │   ├── process-score.ts
│   │   ├── bias-metrics.ts
│   │   ├── calibration.ts
│   │   └── monte-carlo.ts
│   ├── db/ (drizzle schema)
│   └── market/ (kis, pykrx-bridge)
├── components/
└── scripts/collector/           ← Python 수집기
```

> 🔑 **핵심 원칙**: 모든 계산 로직(`lib/domain/`)은 **DB·UI와 무관한 순수 함수**로 분리합니다. AI에게 "이 함수만 고쳐줘"가 가능해지고, 단위 테스트로 회귀를 잡을 수 있습니다. 바이브 코딩에서 이 분리가 있느냐 없느냐가 3주 뒤 프로젝트의 생사를 가릅니다.

---

# PART D. 데이터 모델 (스키마 전문)

> AI 코딩 시 이 섹션을 **그대로 붙여넣으면** 스키마가 한 번에 생성됩니다.

```sql
-- ══════════════════════════════════════════════
-- 1. 사용자 & 계좌 설정
-- ══════════════════════════════════════════════
create table profiles (
  id uuid primary key references auth.users,
  display_name text,
  account_size numeric not null default 10000000,   -- 계좌 규모(원)
  default_risk_pct numeric not null default 1.0,    -- 기본 리스크 %
  max_risk_pct numeric not null default 2.0,        -- 경고 임계값
  fee_bps numeric not null default 1.5,             -- 수수료 (bp)
  tax_bps numeric not null default 15,              -- 거래세+농특세 (bp, 매도 시)
  slippage_bps numeric not null default 10,         -- 슬리피지 가정
  created_at timestamptz default now()
);

-- ══════════════════════════════════════════════
-- 2. 시장 데이터
-- ══════════════════════════════════════════════
create table ticker_master (
  ticker text primary key,          -- '005930'
  name text not null,
  market text,                      -- KOSPI / KOSDAQ
  sector text,
  listed_from date,
  delisted_at date,                 -- ⭐ 서바이버십 바이어스 방지
  market_cap bigint
);

create table ohlcv_daily (
  ticker text not null references ticker_master,
  d date not null,
  open numeric, high numeric, low numeric, close numeric,
  volume bigint, value bigint,
  adj_close numeric,                -- 액면분할/배당 조정
  primary key (ticker, d)
);
create index on ohlcv_daily (d);

create table investor_flow (             -- 한국시장 특화: 수급
  ticker text not null references ticker_master,
  d date not null,
  foreign_net bigint,                    -- 외국인 순매수(원)
  institution_net bigint,
  individual_net bigint,
  program_net bigint,
  primary key (ticker, d)
);

-- ══════════════════════════════════════════════
-- 3. M1 의사결정 저널 (핵심 테이블)
-- ══════════════════════════════════════════════
create type trade_status as enum ('planned','open','closed','cancelled');
create type setup_type as enum ('breakout','pullback','reversal','earnings','flow','event','other');
create type horizon_type as enum ('scalp','day','swing','position');
create type stop_basis as enum ('technical','atr','max_loss','time');
create type source_type as enum ('live','replay','drill');

create table trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles,
  source source_type not null default 'live',   -- 실전/리플레이/드릴 구분
  ticker text,
  masked_label text,                            -- 리플레이용 '종목 A'
  status trade_status not null default 'planned',

  -- 진입 (append-only, 저장 후 수정 불가)
  entry_at timestamptz,
  entry_price numeric,
  quantity int,
  direction text default 'long',

  -- 사전 확약 (Pre-commitment)
  thesis text not null,                         -- 최소 50자 강제
  setup setup_type not null,
  horizon horizon_type not null,
  invalidation text not null,                   -- ⭐ 무효화 조건
  stop_price numeric not null,
  stop_basis stop_basis not null,
  target1_price numeric,
  target2_price numeric,
  confidence int not null check (confidence between 0 and 100),
  planned_risk_pct numeric,
  planned_r_multiple numeric,                   -- 자동계산

  -- 심리 상태
  emotion_tags text[],
  prev_trade_pnl_r numeric,                     -- 자동 주입 (보복매매 탐지)
  condition_score int check (condition_score between 1 and 5),

  -- 청산
  exit_at timestamptz,
  exit_price numeric,
  exit_reason text,                             -- stop/target/discretionary/time
  realized_r numeric,
  realized_pnl numeric,
  mae_r numeric,                                -- Maximum Adverse Excursion
  mfe_r numeric,                                -- Maximum Favorable Excursion

  -- 채점
  process_score int,
  process_breakdown jsonb,
  quadrant text,                                -- skill/luck/badluck/mistake

  journal_locked_at timestamptz,                -- 진입 후 30분 잠금
  created_at timestamptz default now()
);
create index on trades (user_id, entry_at desc);

-- 진입 후 추가 행동 (append-only 로그)
create table trade_events (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references trades on delete cascade,
  at timestamptz default now(),
  kind text not null,     -- add_position/reduce/move_stop/note/emotion
  payload jsonb,
  note text
);

-- ══════════════════════════════════════════════
-- 4. M5 캘리브레이션
-- ══════════════════════════════════════════════
create table calibration_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles,
  trade_id uuid references trades,
  predicted_prob numeric not null,
  outcome boolean,
  resolved_at timestamptz,
  context text                                  -- 'trade' | 'quiz'
);

-- ══════════════════════════════════════════════
-- 5. M7 리플레이 세션
-- ══════════════════════════════════════════════
create table replay_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles,
  ticker text not null,                         -- 세션 종료 전까지 클라이언트 미전송
  start_date date not null,
  current_index int not null default 0,
  level int not null default 1,
  seed text,
  revealed boolean default false,
  created_at timestamptz default now()
);

-- ══════════════════════════════════════════════
-- 6. M8 드릴
-- ══════════════════════════════════════════════
create table drill_cards (
  id uuid primary key default gen_random_uuid(),
  code text unique,                             -- 'DRILL-07'
  title text, situation jsonb, options jsonb,
  scoring_rubric jsonb, concept_tags text[]
);
create table drill_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles,
  card_id uuid references drill_cards,
  chosen text, confidence int, rationale text,
  consistency_score numeric,                    -- 과거 동일 카드 응답과의 일관성
  answered_at timestamptz default now()
);

-- ══════════════════════════════════════════════
-- 7. M9 룰 백테스트
-- ══════════════════════════════════════════════
create table rule_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles,
  name text, definition jsonb,                  -- 노코드 룰 JSON
  version int default 1,
  search_count int default 0,                   -- ⭐ 과최적화 경고 카운터
  created_at timestamptz default now()
);
create table backtest_runs (
  id uuid primary key default gen_random_uuid(),
  rule_set_id uuid references rule_sets,
  period_start date, period_end date,
  is_out_of_sample boolean,
  metrics jsonb, equity_curve jsonb,
  ran_at timestamptz default now()
);

-- ══════════════════════════════════════════════
-- 8. M11 학습 카드 (SRS)
-- ══════════════════════════════════════════════
create table srs_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles,             -- null이면 공용 덱
  front text, back text,
  concept_tags text[],
  source_trade_id uuid references trades,       -- 실수 기반 자동생성
  ease numeric default 2.5, interval_days int default 1,
  due_at timestamptz default now(), reps int default 0
);

-- ══════════════════════════════════════════════
-- 9. M10 AI 코칭 로그
-- ══════════════════════════════════════════════
create table coach_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles,
  kind text,                                    -- premortem/postmortem/weekly/monthly
  input_context jsonb, output jsonb,
  experiment_suggested text,                    -- 다음 10거래 실험 과제
  experiment_status text default 'pending',
  created_at timestamptz default now()
);
```

**RLS 정책 (Supabase, 전 테이블 필수)**:
```sql
alter table trades enable row level security;
create policy "own rows" on trades
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- 나머지 사용자 데이터 테이블에도 동일 패턴 적용
```

---

# PART E. 단계별 바이브 코딩 프롬프트 (복붙용)

> **사용법**: 각 Phase 프롬프트를 **순서대로** Claude Code(또는 Windsurf/Cursor)에 그대로 붙여넣으십시오.
> 한 Phase가 끝날 때마다 반드시 커밋하고, 수용 기준(AC)을 직접 눈으로 확인한 뒤 다음으로 넘어가십시오.
> **Phase를 건너뛰거나 두 개를 합쳐서 요청하지 마십시오.** 바이브 코딩 실패의 90%는 한 번에 너무 많이 시킬 때 발생합니다.

---

## Phase 0 — 프로젝트 규칙 파일 생성 (`CLAUDE.md`)

> 이 파일이 이후 모든 Phase의 품질을 결정합니다. **가장 먼저, 가장 정성껏** 만드십시오.

### 📋 PROMPT 0

````
새 프로젝트 `trader-lab`을 시작한다. 코드를 작성하기 전에, 이 저장소의 루트에
`CLAUDE.md`를 만들어라. 내용은 아래를 그대로 반영하되 마크다운으로 정리해라.

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
   DB, fetch, React, Date.now() 를 절대 참조하지 않는다.
   현재 시각이 필요하면 인자로 주입받는다.
2. `lib/domain/`의 모든 export 함수는 같은 이름의 `.test.ts`를 반드시 가진다.
3. React 컴포넌트에 비즈니스 계산 로직을 넣지 않는다. 계산은 lib/domain 호출.
4. DB 접근은 Server Component 또는 Route Handler에서만. 클라이언트 컴포넌트 금지.
5. Supabase 모든 사용자 테이블에 RLS를 켜고 `auth.uid() = user_id` 정책을 적용한다.
6. 외부 API 키(ANTHROPIC_API_KEY, KIS_APP_SECRET 등)는 서버 전용.
   `NEXT_PUBLIC_` 접두사를 절대 붙이지 않는다.
7. 금액·가격·수량은 number로 다루되, 비교/집계 시 부동소수 오차를 고려해
   `lib/domain/money.ts`의 round 유틸을 사용한다.

## 도메인 용어 (코드에서 이 이름 그대로 사용)
- `R` (R-multiple): 1R = 진입 시 감수하기로 한 손실액.
  realizedR = (exitPrice - entryPrice) / (entryPrice - stopPrice)  // long 기준
- `processScore`: 0~100. 결과와 완전히 독립적인 프로세스 점수.
- `quadrant`: 'skill' | 'luck' | 'badluck' | 'mistake'
- `MAE/MFE`: 보유 중 최대 역행/순행 폭 (R 단위)
- `invalidation`: 진입 시 선언한 "내가 틀렸음을 알 수 있는 조건"
- `expectancy`: winRate * avgWinR - lossRate * avgLossR

## 절대 금지 (Anti-goals)
- 종목 추천, 목표주가 예측, 매매 시그널, 시황 단정 생성
- 수익률 기준 사용자 랭킹/리더보드
- 저장된 진입 저널의 사후 수정 기능 (append-only 만 허용)
- 백테스트/리플레이에서 미래 데이터를 클라이언트로 전송 (look-ahead 금지)

## 작업 방식
- 한 번에 한 모듈만 수정한다. 요청되지 않은 파일을 리팩터링하지 않는다.
- 새 의존성 추가 전 반드시 이유를 먼저 설명하고 승인을 받는다.
- 스키마 변경은 항상 마이그레이션 파일로 남긴다.
- 작업 완료 후 변경 파일 목록과 수동 확인 방법을 3줄 이내로 요약한다.

작성 후, Next.js 15 + TypeScript + Tailwind + shadcn/ui 초기 프로젝트를 스캐폴딩하고
`lib/domain/`, `components/`, `docs/` 디렉토리를 생성해라. 아직 기능 구현은 하지 마라.
````

**✅ 수용 기준(AC)**: `CLAUDE.md` 존재 / `npm run dev` 기동 / 빈 디렉토리 구조 생성 / 기능 코드 없음

---

## Phase 1 — 도메인 순수 함수 + 테스트 (UI보다 먼저!)

> **왜 UI보다 먼저인가**: 계산이 틀린 채로 UI를 만들면, 나중에 숫자가 이상할 때 원인이 UI인지 계산인지 구분이 안 됩니다. 순수 함수 + 테스트를 먼저 못박으면 이후 모든 Phase가 안정됩니다.

### 📋 PROMPT 1

````
`lib/domain/` 아래에 아래 순수 함수 모듈들과 각각의 Vitest 테스트를 작성해라.
DB나 React를 import 하지 마라. 모든 함수는 입력만 받아 출력을 반환한다.

## 1) lib/domain/types.ts
Trade, TradeEvent, ProfileSettings 타입 정의.
필드는 아래 SQL 스키마와 1:1로 맞춰라. (직접 SQL을 붙여넣어 주십시오 → PART D 참조)

## 2) lib/domain/r-multiple.ts
- calcPlannedR(entry, stop, target): number
- calcRealizedR(entry, stop, exit, direction): number
- calcRiskAmount(accountSize, riskPct): number
- calcPositionSize(accountSize, riskPct, entry, stop): number  // 정수 주(株) 내림
- applyCosts(grossR, entry, stop, feeBps, taxBps, slippageBps): number
  → 비용을 R 단위로 차감한 순 R을 반환. 매도 시에만 세금 적용.
엣지 케이스: entry == stop 이면 0으로 나누기 → null 반환 (throw 금지)

## 3) lib/domain/process-score.ts
calcProcessScore(trade, events, settings) → { total: number, breakdown: Record<string,number> }
배점:
  hasPlan 20        : entry_at 기준 30분 내 저널 작성 → 만점, 초과 시 0
  invalidationQuality 15 : invalidation 문자열이 20자 이상 + 숫자나 지표명 포함 → 15,
                           20자 이상 → 8, 그 외 0
  stopDiscipline 25 : 손절가 이탈 후 익일 종가까지 미청산이면 0, 준수 시 25,
                      손절가를 불리하게 이동(move_stop 이벤트)했으면 0
  sizing 15         : plannedRiskPct <= settings.maxRiskPct → 15, 1.5배 이내 → 7, 초과 0
  noAveragingDown 10: 손실 구간에서 add_position 이벤트 있으면 0
  horizonRespect 10 : 선언 horizon 대비 실제 보유기간이 규정 범위 내면 10
                      (scalp<1d, day<=1d, swing 2~10d, position>=10d), 이탈 시 0
  emotion 5         : emotion_tags에 'fomo' 또는 'revenge' 없으면 5, 있으면 0

calcQuadrant(processScore, realizedR) → 'skill'|'luck'|'badluck'|'mistake'
  기준선: processScore >= 70, realizedR > 0

## 4) lib/domain/metrics.ts
calcMetrics(trades: Trade[]) → {
  n, winRate, avgWinR, avgLossR, expectancy, profitFactor,
  maxConsecutiveLosses, maxDrawdownR, sqn, cumulativeR,
  kellyFraction, quarterKelly
}
- sqn = sqrt(n) * mean(R) / stdev(R)
- kellyFraction = (b*p - q) / b, 여기서 b = avgWinR/|avgLossR|
- n < 30이면 결과 객체에 `insufficientSample: true` 플래그를 포함시켜라.

bootstrapCI(values: number[], statFn, iterations=1000, alpha=0.05)
 → { lower, upper } 부트스트랩 신뢰구간. 시드 주입 가능하게 만들어라.

## 5) lib/domain/bias-metrics.ts
calcDispositionEffect(trades) → { pgr, plr, index }
calcRevengeTradingRate(trades, windowMinutes=60) → number
calcOvertradingSlope(trades) → number   // 월 거래수 vs 월 합계R 단순회귀 기울기
calcAveragingDownRate(trades, events) → number
calcStopDelayHours(trades, events) → number
calcFomoStats(trades, priceContext) → { rate, winRate, avgR }
calcBiasRadar(...) → 6개 항목 0~100 점수 (100 = 위험)

## 6) lib/domain/calibration.ts
bucketize(records, bucketSize=10) → 구간별 { predicted, actual, count }
brierScore(records) → number
calibrationError(records) → number   // ECE (Expected Calibration Error)

## 7) lib/domain/monte-carlo.ts
simulate(rDistribution: number[], opts: {trials, tradesPerTrial, riskPct, seed})
 → { finalReturns: number[], maxDrawdowns: number[], ruinProbability,
     percentiles: {p5,p25,p50,p75,p95}, longestLossStreakDist }
- 반드시 시드 기반 결정론적 PRNG(예: mulberry32)를 직접 구현해서 사용해라.
  Math.random() 사용 금지 (테스트 재현성).

## 테스트 요구사항
각 모듈마다 최소 5개 케이스: 정상 / 경계 / 0으로 나누기 / 빈 배열 / 음수 방향(short).
`npm run test`가 전부 통과해야 한다.
````

**✅ AC**: `npm run test` 전체 통과 / `lib/domain`에 react·db import 0건 / 몬테카를로 동일 시드 → 동일 결과

---

## Phase 2 — DB 스키마 + 인증

### 📋 PROMPT 2

````
Supabase + Drizzle ORM을 연결하고 스키마를 구축해라.

1. `lib/db/schema.ts`에 Drizzle 스키마를 작성해라.
   내용은 아래 SQL을 그대로 옮긴 것이어야 한다.
   [여기에 PART D의 SQL 전문을 붙여넣으십시오]

2. `drizzle.config.ts` 및 마이그레이션 생성 스크립트를 설정해라.

3. Supabase Auth (이메일 매직링크)를 붙이고,
   `app/(auth)/login` 페이지와 미들웨어 기반 보호 라우트를 만들어라.

4. 모든 사용자 데이터 테이블에 RLS를 켜는 SQL 마이그레이션을 별도 파일로 생성해라.
   정책: `auth.uid() = user_id` (select/insert/update/delete 전부)

5. 회원가입 시 `profiles` 행을 자동 생성하는 Postgres 트리거를 작성해라.

6. `app/settings` 페이지: 계좌 규모, 기본/최대 리스크%, 수수료·세금·슬리피지 bp 설정.

주의:
- SUPABASE_SERVICE_ROLE_KEY는 서버 전용. 클라이언트 번들에 절대 포함시키지 마라.
- `.env.example`을 만들고 실제 `.env.local`은 .gitignore에 넣어라.
````

**✅ AC**: 로그인/로그아웃 동작 / 다른 사용자 데이터 조회 시 0건 반환(RLS 검증) / 설정 저장·재조회 정상

---

## Phase 3 — M1 의사결정 저널 (핵심 화면)

### 📋 PROMPT 3

````
M1 의사결정 저널을 구현해라. 이 앱의 심장이다.

## 3-1. 진입 기록 폼  `app/journal/new`
shadcn/ui Form + zod 검증. 필드와 검증 규칙:

[가설 섹션]
- thesis: textarea, 최소 50자 (미달 시 "논거를 언어화하지 못했다면 아직 논거가 아닙니다")
- setup: select (돌파/눌림목/역추세/실적/수급/이벤트/기타)
- horizon: select (스캘핑/데이트레이드/스윙 2~10일/포지션 1개월+)

[무효화 섹션 — 가장 중요]
- invalidation: textarea 필수, 최소 20자
  플레이스홀더는 3개를 랜덤 로테이션:
   "종가가 20일선 아래로 마감하면"
   "거래량 감소 상태로 3거래일 횡보하면"
   "실적 발표 후 갭하락으로 시작하면"
  입력값에 숫자나 지표명(이평/이동평균/RSI/거래량/지지/저항/%)이 없으면
  경고 배지: "검증 가능한 조건인가요? 나중에 '발동했는지' 판정할 수 있어야 합니다."
- stopPrice: number 필수
- stopBasis: select (기술적 지지선/ATR 배수/최대손실액/시간손절)

[기대 섹션]
- target1Price, target2Price: number
- confidence: Slider 0~100, 5단위
- plannedR: 자동 계산 표시. 1.5 미만이면 노란 경고
   "손익비 1.5 미만입니다. 승률 60% 이상이어야 기대값이 양수가 됩니다."

[사이징 섹션]
- plannedRiskPct: number. settings.maxRiskPct 초과 시 빨간 경고
- 수량 자동 계산 표시 (lib/domain/r-multiple.calcPositionSize 사용)
- 실제 투입 금액과 계좌 대비 비중도 함께 표시

[상태 섹션]
- emotionTags: 토글 그룹 다중선택 (평온/조급/FOMO/복수심/자신만만/불안/지루함)
- conditionScore: 1~5 별점
- 직전 거래 손익(R)을 자동 조회해 읽기 전용으로 표시.
  직전 거래가 손실이고 그 청산이 60분 이내면 배너:
  "직전 손실 청산 후 42분 경과. 보복매매 가능성을 점검하세요."

## 3-2. 저장 규칙 (핵심)
- 저장 시 `journal_locked_at = now()` 설정
- 저장 후 **thesis/invalidation/stopPrice/target/confidence는 수정 불가**로 잠근다
  (UI에서 disabled + 서버 액션에서도 재검증)
- 이후 모든 변경은 `trade_events`에 append만 가능
- entry_at 입력 시각과 저장 시각 차이가 30분 초과면
  "사후 작성됨" 플래그를 남기고 processScore의 hasPlan을 0으로 처리

## 3-3. 청산 기록  `app/journal/[id]/close`
- exitPrice, exitAt, exitReason(손절/목표/재량/시간) 입력
- 저장 시 realizedR, MAE/MFE(보유기간 OHLC로 계산), processScore, quadrant 자동 산출

## 3-4. 계획 vs 실제 대조 화면  `app/journal/[id]`
좌우 2컬럼 비교 카드:
  좌: 진입 시 선언한 값 (목표가/손절가/확신도/예상R/무효화조건/예상 보유기간)
  우: 실제 결과 (청산가/최저도달/적중여부/실현R/무효화 발동여부/실제 보유기간)
불일치 항목은 주황색 배경으로 강조.
하단에 trade_events 타임라인(시간순 append 로그).

## 3-5. 목록  `app/journal`
테이블: 날짜/종목/셋업/확신도/실현R/프로세스점수/사분면 배지.
필터: 기간, 셋업, 사분면, source(live/replay/drill).

주의: 서버 액션에서 반드시 zod로 재검증해라. 클라이언트 검증만 믿지 마라.
````

**✅ AC**: 50자 미만 thesis 저장 거부 / 저장 후 thesis 수정 불가 확인 / 청산 시 R 자동계산 정확 / 대조 화면 불일치 강조 표시

---

## Phase 4 — M3 R-멀티플 대시보드 + M2 프로세스 스코어카드

### 📋 PROMPT 4

````
M3(성과 대시보드)와 M2(프로세스 스코어카드)를 구현해라.
계산은 전부 lib/domain/metrics.ts, process-score.ts를 호출하고 새로 짜지 마라.

## 4-1. `app/metrics` — R 대시보드
상단 KPI 카드 8개: 거래수, 승률, 평균승R, 평균패R, 기대값, Profit Factor, SQN, 최대연속손실

⚠️ 필수 규칙: n < 30 이면 화면 최상단에 회색 배너를 고정 표시해라.
  "표본 {n}건. 통계적 판단에는 최소 30건이 필요합니다. 아래 수치는 참고용입니다."
  그리고 승률·기대값 옆에 부트스트랩 95% 신뢰구간을 반드시 병기해라.
  예: `승률 62% [95% CI: 44%~78%]`
  절대로 "승률 70%! 훌륭합니다" 같은 단정적 칭찬 문구를 넣지 마라.

차트 3개 (Recharts):
1. R 분포 히스토그램 (0.5R 단위 bin)
   - -1R보다 왼쪽(더 나쁜) 막대는 빨간색으로 칠하고,
     범례에 "손절 규칙 미준수의 흔적" 이라고 표시
2. 누적 R 곡선 (선형)
3. 켈리 게이지: fullKelly와 quarterKelly를 나란히,
   현재 설정된 riskPct 위치를 마커로 표시
   캡션: "풀 켈리는 이론적 최대 성장률이지만 실무에서는 파산 위험이 큽니다.
          1/4 켈리가 일반적 권장치입니다."

## 4-2. `app/scorecard` — 프로세스 스코어카드
1. 2×2 산점도 (Recharts ScatterChart)
   X = processScore(0~100), Y = realizedR
   사분면 배경색:
     우상(skill) 초록 / 우하(badluck) 파랑 / 좌상(luck) **빨강 테두리 강조** / 좌하(mistake) 회색
   좌상단 영역 위에 고정 라벨: "⚠️ 운이 좋았던 거래 — 반복되지 않습니다"
   점 클릭 → 해당 저널 상세로 이동

2. 사분면 비중 도넛 + 전월 대비 증감

3. 프로세스 점수 항목별 평균 막대차트 (7개 항목)
   가장 낮은 항목에 "이번 달 집중 개선 항목" 배지 자동 부여

4. 상관 분석 카드
   processScore와 realizedR의 피어슨 상관계수 + 산식 설명.
   r >= 0.3 이면 "당신의 프로세스는 실제로 성과와 연결되어 있습니다"
   r < 0.1 이면 "아직 프로세스 정의가 성과와 무관합니다. 채점 기준을
   당신의 전략에 맞게 조정할 필요가 있습니다" 문구 표시.

## 4-3. 공통
- 기간 필터(1M/3M/6M/1Y/전체), source 필터(실전만/리플레이 포함)
- 실전과 리플레이 데이터는 기본적으로 **분리 표시**한다. 섞지 마라.
````

**✅ AC**: n<30일 때 신뢰구간 배너 표시 / 산점도 사분면 색상 정확 / 실전·리플레이 분리 확인

---

## Phase 5 — M4 행동 편향 탐지기 + M6 반사실 시뮬레이터

### 📋 PROMPT 5

````
M4(편향 레이더)와 M6(반사실 시뮬레이터)를 구현해라.

## 5-1. `app/bias` — 행동 편향 레이더
lib/domain/bias-metrics.ts 사용. 6축 레이더 차트(Recharts RadarChart).
축: 처분효과 / 보복매매 / 과잉거래 / 물타기 / 손절지연 / FOMO추격
0=건강(중심), 100=위험(외곽).

각 축 아래에 아코디언 카드. 카드 구조는 반드시 아래 4단 구성:
  ① 수치 + 임계값 대비 상태 배지
  ② 학술적 설명 (2~3문장, 연구자명·연도 포함)
  ③ 당신의 데이터 (해당 거래 목록 링크 + 추정 손실 R)
  ④ 처방 (다음 N거래에 적용할 구체적 규칙 1개)

임계값:
  처분효과 index > 0.10 / 보복매매율 > 15% / 과잉거래 기울기 < 0
  물타기율 > 0 / 손절지연 > 24h / FOMO승률 < 전체승률

설명 텍스트는 하드코딩된 템플릿 + 수치 보간으로 생성해라.
이 단계에서 AI API를 호출하지 마라. (Phase 8에서 붙인다)

## 5-2. `app/counterfactual` — 반사실 시뮬레이터
`lib/domain/counterfactual.ts`를 새로 만들어라 (순수 함수 + 테스트).

시나리오 7종을 동일 거래 집합에 적용해 각각 누적 R 곡선을 산출:
  actual / stopDiscipline / targetDiscipline / noAveraging
  / processFilter70 / noFomo / topHalfConfidence

⚠️ 절대 규칙 (look-ahead 금지):
- stopDiscipline은 "보유기간 중 저가가 stopPrice를 터치한 날" 종가가 아니라
  stopPrice에 체결된 것으로 계산한다. 그 이후의 가격은 일절 참조하지 않는다.
- "최고점에서 팔았다면" 같은 사후 최적화 시나리오는 만들지 마라.
- 각 시나리오는 반드시 '진입 시점에 이미 선언되어 있던 규칙'만 적용해야 한다.

출력:
1. 7개 곡선 오버레이 라인차트 (actual은 굵은 검정, 나머지는 반투명)
2. 요약 테이블: 시나리오 / 누적R / MDD / 거래수 / actual 대비 차이
3. 자동 결론 문장: 개선폭이 가장 큰 시나리오 1개를 골라
   "당신에게 필요한 것은 더 나은 종목이 아니라 {행동}입니다. (+{n}R)"
   개선폭이 전부 1R 미만이면 "현재 규칙 준수도가 높습니다"로 대체.
````

**✅ AC**: 편향 카드 4단 구성 완비 / 반사실 계산에 미래 데이터 참조 없음(코드 리뷰로 확인) / 시나리오별 거래수 차이가 논리적으로 일관

---

## Phase 6 — M7 바 리플레이 시뮬레이터 (기술적 난이도 최고)

> ⚠️ 이 Phase는 다른 것보다 어렵습니다. **반드시 별도 세션에서, 다른 작업과 섞지 말고** 진행하십시오.

### 📋 PROMPT 6

````
M7 블라인드 바 리플레이 시뮬레이터를 구현해라.
lightweight-charts를 사용한다.

## 6-1. 보안 요구사항 (최우선, 타협 불가)
미래 봉 데이터가 **어떤 경로로도** 클라이언트에 도달해서는 안 된다.
- 세션 시작 시 서버는 초기 120봉만 전송한다.
- 이후 봉은 `POST /api/replay/next-bar` 로 1개씩만 받는다.
- 응답에 ticker, 실제 날짜, 종목명을 포함하지 마라. `{o,h,l,c,v,idx}` 만.
- 세션의 ticker/시작일은 서버 DB(replay_sessions)에만 저장한다.
- 세션 종료(revealed=true) 후에만 종목명·날짜를 반환하는 별도 엔드포인트를 둔다.
- 클라이언트 상태나 React Query 캐시에 전체 시계열을 미리 담지 마라.

## 6-2. 세션 생성  `POST /api/replay/session`
필터 파라미터: 시장(KOSPI/KOSDAQ), 시총 구간, 레벨(1~5), 랜덤 시드
종목 유니버스에는 **상장폐지 종목도 포함**한다 (ticker_master.delisted_at 활용).
데이터가 250봉 이상 확보되는 구간에서만 시작점을 뽑는다.

## 6-3. 리플레이 화면  `app/replay/[sessionId]`
레이아웃:
- 좌측 80%: lightweight-charts 캔들 차트, 제목은 "종목 A", X축 라벨은 D-120, D-119...
- 우측 20%: 컨트롤 패널
  [다음 봉 ▶] (스페이스바), [10봉 진행], [매수], [매도], [세션 종료]
  현재 포지션 상태, 미실현 R, 진행 봉 수
- 레벨별 표시 요소 제어:
  L1 캔들만 / L2 +이동평균(5,20) / L3 +거래량 / L4 60분봉 전환
  / L5 +투자자 수급 서브차트 + 코스피 지수 오버레이

## 6-4. 매매 시 저널 강제
[매수] 클릭 → 모달로 저널 축약본 입력 (thesis 30자+, invalidation, 손절, 목표, 확신도)
입력 없이는 진입 불가. `trades` 테이블에 source='replay', ticker=null,
masked_label='종목 A'로 저장.

## 6-5. 세션 종료 화면
- 종목명, 실제 기간 공개
- 전체 차트에 내 진입/청산 지점 마커 표시
- 실현 R, 프로세스 점수 산출
- 해당 기간의 실제 이벤트 표시(가능하면 DART 공시 제목 리스트)
- "다시 하기(같은 시드)" / "새 세션" 버튼

## 6-6. 상태 관리
- 진행 인덱스는 서버(replay_sessions.current_index)가 단일 진실 원천이다.
- 새로고침해도 이어서 진행되어야 한다.
- 클라이언트에서 인덱스를 임의로 점프시키는 요청은 서버에서 거부해라
  (current_index + 1 만 허용).
````

**✅ AC**: 개발자도구 네트워크 탭에서 미래 봉 노출 0건 / 새로고침 후 세션 재개 / 종목명 세션 종료 전 미노출 / index 조작 요청 거부

---

## Phase 7 — M9 노코드 룰 백테스터

### 📋 PROMPT 7

````
M9 노코드 룰 백테스터를 구현해라.

## 7-1. 룰 DSL 정의  `lib/domain/rule-dsl.ts`
JSON 스키마로 룰을 표현한다. 예시:
{
  "entry": { "op": "AND", "conditions": [
    {"lhs":{"indicator":"close"}, "cmp":">", "rhs":{"indicator":"sma","period":20}},
    {"lhs":{"indicator":"volume"}, "cmp":">",
     "rhs":{"indicator":"sma","source":"volume","period":20,"multiplier":1.5}},
    {"lhs":{"indicator":"rsi","period":14}, "cmp":"<", "rhs":{"const":70}}
  ]},
  "exclude": { "op":"OR", "conditions":[
    {"lhs":{"field":"marketCap"}, "cmp":"<", "rhs":{"const":300000000000}}
  ]},
  "exit": {
    "stop": {"type":"atr","period":14,"multiplier":2},
    "target": {"type":"pct","value":8},
    "timeStop": {"bars":10}
  },
  "sizing": {"riskPct":1.0},
  "costs": {"feeBps":1.5,"taxBps":15,"slippageBps":10}
}

지원 지표: close/open/high/low/volume, sma, ema, rsi, atr, bbands,
          highest, lowest, 외국인순매수누적(foreignNetSum)

## 7-2. 백테스트 엔진  `lib/domain/backtest.ts` (순수 함수)
- 신호는 봉 종가에서 판정하고, 체결은 **다음 봉 시가**로 한다 (look-ahead 방지).
- 슬리피지·수수료·세금을 매 체결에 반영한다.
- 동시 보유 종목 수 제한 파라미터를 둔다.
- 상장폐지 종목은 폐지일에 강제 청산 처리한다.
- 결과는 개별 trade 리스트 + 집계 metrics로 반환.
- 반드시 Vitest 테스트 작성. 특히 "다음 봉 시가 체결"을 검증하는 케이스 포함.

## 7-3. UI  `app/backtest`
- 조건 빌더: 드롭다운 조합으로 룰 JSON을 생성 (코드 입력 없이)
- 실행 버튼, 진행률 표시

## 7-4. 교육적 안전장치 (필수)
1. **워크포워드 강제 분할**
   기간을 자동으로 In-sample(앞 70%)과 Out-of-sample(뒤 30%)로 나누고
   두 결과를 **항상 나란히** 보여줘라. IS만 보여주는 화면을 만들지 마라.
   OOS 성과가 IS의 50% 미만이면 빨간 경고:
   "과최적화 가능성이 높습니다. 이 규칙은 과거에만 작동했을 수 있습니다."

2. **다중검정 카운터**
   같은 rule_set에 대한 파라미터 변경 실행 횟수를 search_count로 누적.
   20회 초과 시 배너:
   "이 규칙에 대해 {n}회 탐색했습니다. 무작위 데이터에서도 20회 시도하면
    우연히 좋은 결과가 나옵니다(다중검정 문제). 미학습 기간 검증이 필수입니다."

3. **최악 구간 표시**
   전체 성과와 동등한 크기로 '최악의 연속 6개월 구간' 성과를 표시해라.
   평균만 보여주면 사용자는 최악을 준비하지 못한다.

4. **표본 경고**: 신호 발생 건수 30 미만이면 결과를 흐리게 처리하고
   "표본 부족" 오버레이를 씌워라.
````

**✅ AC**: 다음 봉 시가 체결 테스트 통과 / IS·OOS 항상 병렬 표시 / 20회 초과 시 경고 / 상장폐지 종목 포함

---

## Phase 8 — M10 AI 소크라테스 코치

### 📋 PROMPT 8

````
M10 AI 코치를 Anthropic Claude API로 구현해라.

## 8-1. 서버 라우트  `app/api/ai/coach/route.ts`
- 모델: claude-sonnet-4-6
- ANTHROPIC_API_KEY는 서버 환경변수. 클라이언트 노출 금지.
- 요청 body: { kind: 'premortem'|'postmortem'|'weekly'|'monthly', tradeId?, period? }
- 서버에서 필요한 데이터를 DB에서 직접 조회해 컨텍스트를 구성한다.
  클라이언트가 보낸 거래 데이터를 그대로 신뢰하지 마라.

## 8-2. 시스템 프롬프트 (아래를 그대로 사용)
---
당신은 트레이딩 코치입니다. 사용자의 매매 기록을 분석해 사고의 빈틈을 질문으로 드러냅니다.

[반드시 하는 것]
- 사용자가 선언한 계획과 실제 행동의 불일치를 구체적으로 지적한다
- 제공된 통계 수치를 인용해 패턴을 제시한다
- 행동재무학 개념(처분효과, 앵커링, 확증편향, 매몰비용, 손실회피)과 연결한다
- 다음 10거래에 적용할 검증 가능한 실험 1가지만 제안한다

[절대 하지 않는 것]
- 특정 종목의 매수/매도/보유 의견 제시
- 목표주가, 가격 예측, 상승/하락 전망
- "지금은 상승장/하락장입니다" 같은 시황 단정
- 근거 없는 위로나 격려
- 사용자가 제공하지 않은 수치를 지어내기

[톤]
단정하지 말고 질문하십시오. 판단은 사용자가 내립니다.
한국어로, 존댓말로, 간결하게 씁니다.

[출력 형식]
반드시 아래 JSON만 출력하십시오. 마크다운 코드펜스나 설명을 붙이지 마십시오.
{
  "observations": [{"claim": "...", "evidence": "..."}],
  "questions": ["...", "...", "..."],
  "concept": {"name": "...", "explanation": "..."},
  "experiment": {"rule": "...", "duration": "다음 10거래", "successMetric": "..."}
}
---

## 8-3. kind별 컨텍스트 구성
- premortem: 방금 저장한 저널 1건.
  user 메시지: "이 거래가 3주 후 최악의 손실이 되었다고 가정하십시오.
  가장 그럴듯한 실패 원인 3가지와, 지금 확인해야 할 질문을 제시하십시오."
- postmortem: 청산된 거래 1건 + 계획/실제 대조 데이터
- weekly: 최근 7일 저널 + 편향 지표 스냅샷
- monthly: 최근 30일 집계 + 전월 대비 변화 + 진행 중인 실험 결과

## 8-4. 응답 처리
- JSON 파싱 실패 시 코드펜스를 제거하고 1회 재시도, 그래도 실패하면 에러 UI.
- 결과를 coach_sessions에 저장한다.
- experiment는 별도로 추적: 다음 10거래 동안 준수율을 자동 계산해
  대시보드 상단에 진행 바로 표시한다. (실험이 실제로 실행되게 만드는 장치)

## 8-5. UI  `app/coach`
- 카드 4종(관찰/질문/개념/실험)으로 렌더링
- 질문 각각에 사용자가 답변을 적을 수 있는 텍스트 영역 → trade_events에 저장
- 진행 중 실험 위젯: "실험: 손절가 이동 금지 — 7/10 거래 준수"

## 8-6. 비용 관리
- 사용자당 일 호출 한도(예: 20회)를 서버에서 강제해라.
- weekly/monthly는 결과를 캐시하고 같은 기간 재요청 시 캐시를 반환해라.
````

**✅ AC**: 종목명을 넣고 "이거 살까요?" 물어도 추천 거부 / JSON 스키마 준수 / 실험 준수율 자동 추적 / API 키 클라이언트 미노출

---

## Phase 9 — M5 캘리브레이션 · M8 드릴 · M11 SRS · M12 리스크랩

> 이 4개는 서로 독립적입니다. 필요한 순서대로 진행하십시오.

### 📋 PROMPT 9-A (캘리브레이션)
````
M5 캘리브레이션 트레이너를 `app/calibration`에 구현해라.
lib/domain/calibration.ts 사용.

1. 캘리브레이션 곡선: X=선언 확신도 구간(10% 버킷), Y=실제 적중률.
   y=x 완벽선을 점선으로 함께 그리고, 각 점의 크기는 표본 수에 비례.
2. Brier Score 표시 + 시계열 추이. 0.25 기준선을 "동전던지기"로 표기.
3. ECE(Expected Calibration Error) 표시.
4. 자동 진단 문구:
   - 고확신 구간(70%+)의 실제 적중률이 선언치보다 15%p 이상 낮으면 "과신"
   - 낮으면 "과소신뢰"
   - 5%p 이내면 "양호한 캘리브레이션"
5. 주간 예측 퀴즈 `app/calibration/quiz`:
   - 익명화된 차트 20개(종목·날짜 마스킹, 120봉)를 제시
   - 각각 "5거래일 후 상승 확률"을 % 로 입력
   - 제출 후 즉시 채점, calibration_records에 context='quiz'로 저장
   - 결과에 Brier Score와 "무작정 50%로 찍었을 때의 Brier"를 비교 표시
6. 배지: 최근 30건 Brier < 0.18 달성 시 부여. 수익률 기반 배지는 만들지 마라.
````

### 📋 PROMPT 9-B (시나리오 드릴)
````
M8 시나리오 드릴을 `app/drills`에 구현해라.

1. `scripts/seed-drills.ts`로 드릴 카드 20종을 시드해라. 주제:
   손절직전반등 / 목표가1%앞정체 / 갭상승시가 / 갭하락시가 / 실적D-1보유
   / 상한가근접 / VI발동직후 / 시장급락중개별강세 / 3연속손실후진입
   / +2R도달추세지속 / 유상증자공시 / 외국인대량순매도전환 / 거래정지해제일
   / 배당락일보유 / 지수선물급변 / 테마주초기급등추격 / 본전청산유혹
   / 계좌신고점직후사이징 / 마감5분전미체결 / 연휴전포지션유지

   각 카드: situation(JSON: 보유상태·가격·시각·시장상황), options(4지선다),
   scoring_rubric(선택지별 프로세스 정합성 점수 + 해설), concept_tags

2. 채점은 정답/오답이 아니라 **프로세스 정합성**이다.
   - 사전 계획을 사후에 불리하게 변경하는 선택지: 큰 감점
   - 리스크를 확대하는 선택지(물타기 등): 큰 감점
   - 사전 규칙과 일관된 선택지: 만점
   해설에는 "이 선택이 나쁜 이유"가 아니라
   "이 선택이 어떤 사전 규칙을 전제하는가"를 설명해라.

3. **일관성 측정**: 동일 카드를 90일 후 재출제하고,
   두 응답의 차이를 consistency_score로 기록.
   `app/drills/consistency`에서 "당신의 판단은 얼마나 안정적인가"를 시각화.

4. 오답/저점수 카드는 M11 SRS 큐에 자동 추가한다.
````

### 📋 PROMPT 9-C (간격 반복 학습)
````
M11 SRS를 `app/cards`에 구현해라.

1. SM-2 알고리즘을 `lib/domain/srs.ts`에 순수 함수로 구현 + 테스트.
   등급 0~5, ease 계수 갱신, 간격 1→3→7→16→35일, 오답 시 리셋.

2. 공용 덱 시드 (`scripts/seed-cards.ts`) 최소 60장, 카테고리:
   - 리스크관리(R-multiple, 켈리, 포지션사이징, MDD)
   - 행동재무학(전망이론, 처분효과, 앵커링, 확증편향, 매몰비용, 군집행동)
   - 시장미시구조(호가, 유동성, 슬리피지, 시장충격)
   - 한국시장제도(상하한가 30%, VI, 단일가매매, 동시호가, 배당락, 공매도)
   - 통계(표본크기, 다중검정, 생존편향, 과최적화)

3. **개인 실수 카드 자동 생성 (핵심)**
   트리거 조건:
   - 손절 미준수 3회 누적 → 매몰비용/손실회피 카드 생성
   - 처분효과 index > 0.15 → 처분효과 카드 생성
   - 보복매매 3회 → 감정 통제 카드 생성
   - 물타기 2회 → 리스크 확대 카드 생성
   카드 앞면에는 **실제 거래 날짜·종목·수치**를 넣어 개인화하고,
   뒷면에는 개념 설명 + 본인 통계 비교(준수 시 vs 미준수 시 평균 R)를 넣어라.

4. 복습 UI: 앞면 → [기억남/애매/모름] → 뒷면 공개 → 등급 입력.
   키보드 단축키(스페이스=뒤집기, 1~4=등급).
5. 홈 대시보드에 "오늘 복습 N장" 위젯.
````

### 📋 PROMPT 9-D (몬테카를로 리스크랩)
````
M12 리스크랩을 `app/risklab`에 구현해라. lib/domain/monte-carlo.ts 사용.

1. 입력: 본인 실제 R 분포 자동 로드(표본 30건 이상일 때) 또는 수동 가정 입력
   (승률, 평균승R, 평균패R)
2. 시뮬레이션: 부트스트랩 복원추출, 1000회 × 200거래. Web Worker에서 실행해
   UI를 막지 마라.
3. 출력:
   - 최종 수익률 분포 히스토그램 + p5/p25/p50/p75/p95 마커
   - MDD 분포 히스토그램 + 중앙값/95퍼센타일 강조
   - 파산 확률(계좌 -50% 도달)
   - 최장 연속 손실 분포 → "N연속 손실을 겪을 확률 X%"
4. **리스크% 슬라이더 비교 (핵심 교육 장치)**
   0.5/1/2/3/5% 를 동시에 계산해 파산 확률을 나란히 표시.
   3% 초과 구간은 빨간 배경.
   캡션: "동일한 실력(같은 R 분포)이라도 사이징만으로 파산 확률이
          {a}%에서 {b}%로 변합니다."
5. 하단 고정 문구:
   "이 시뮬레이션은 과거 R 분포가 미래에도 유지된다고 가정합니다.
    시장 국면 변화나 전략 열화는 반영되지 않습니다."
````

---

## Phase 10 — 통합 · 온보딩 · 마무리

### 📋 PROMPT 10

````
전체를 통합하고 온보딩 경험을 만들어라.

## 10-1. 홈 대시보드 `app/`
위젯 배치 (우선순위 순):
1. 진행 중 포지션 (있으면) — 각 포지션의 계획 손절가 대비 현재 위치
2. 진행 중 AI 실험 준수율 진행 바
3. 이번 주 프로세스 점수 평균 (전주 대비)
4. 편향 레이더 미니 뷰 — 가장 위험한 축 1개 강조
5. 오늘 복습 카드 N장
6. 최근 5거래 사분면 배지 스트립

⚠️ 홈에 계좌 수익률(%)이나 평가금액을 **크게** 표시하지 마라.
   가장 큰 숫자는 프로세스 점수여야 한다. 이것이 이 제품의 정체성이다.

## 10-2. 온보딩 (첫 로그인 5단계)
1. 계좌 규모 · 리스크 설정
2. "R-multiple이란?" 인터랙티브 설명 (슬라이더로 손절폭 조절 → R 변화 체감)
3. 첫 저널 작성 튜토리얼 (샘플 데이터로)
4. 리플레이 L1 세션 1회 강제 체험
5. 캘리브레이션 퀴즈 10문항 → 베이스라인 Brier Score 기록

## 10-3. 데이터 수집기 `scripts/collector/`
Python. pykrx + FinanceDataReader.
- `backfill.py`: 지정 기간 전종목 일봉 + 투자자 수급 초기 적재
  (요청 간 sleep 0.3s, 실패 시 재시도 3회, 진행률 출력)
- `daily.py`: 매일 18:00 KST 증분 수집
- `master.py`: 종목 마스터 갱신 (신규상장·상장폐지 반영, delisted_at 세팅)
- GitHub Actions 워크플로 파일 작성
- Supabase 적재는 upsert (on conflict do update)

## 10-4. 데이터 이관
- 증권사 거래내역 CSV 임포트 기능 (컬럼 매핑 UI 포함)
- 단, 임포트된 과거 거래는 저널이 없으므로 processScore를 null 처리하고
  "사전 계획 없음" 태그를 붙여라. 억지로 점수를 매기지 마라.
- 전체 데이터 JSON 내보내기 (사용자 소유권 보장)

## 10-5. 마무리 점검
- 모든 페이지 하단에 고정 면책 문구 삽입:
  "본 서비스는 투자 교육 및 자기 훈련 도구이며, 투자자문·투자권유가 아닙니다.
   모든 투자 판단과 그 결과는 이용자 본인에게 귀속됩니다."
- 로딩/빈 상태/에러 상태 UI 전부 채워라.
- 모바일 반응형 확인 (리플레이 화면은 데스크톱 전용으로 안내해도 무방).
- `npm run build` 무경고 통과, `npm run test` 전체 통과.
````

**✅ AC**: 홈에서 가장 큰 숫자 = 프로세스 점수 / 온보딩 5단계 완주 가능 / 수집기 cron 동작 / 빌드·테스트 통과

---

# PART F. 프롬프트 운용 원칙

## F-1. 바이브 코딩 7계명

| # | 원칙 | 구체적 실행 |
|---|---|---|
| 1 | **한 프롬프트 = 한 모듈** | "저널이랑 대시보드 만들어줘" ❌ → Phase 3, Phase 4로 분리 ✅ |
| 2 | **계산을 UI보다 먼저** | Phase 1(순수함수+테스트)을 건너뛰면 이후 전부 무너짐 |
| 3 | **AC(수용 기준)를 프롬프트에 포함** | AI가 자기 검증할 기준이 생김 |
| 4 | **Anti-goal을 명시** | "하지 말 것"이 "할 것"보다 중요할 때가 많음 |
| 5 | **매 Phase 후 커밋** | 롤백 지점 확보. AI가 망가뜨렸을 때 유일한 보험 |
| 6 | **테스트를 협상 카드로** | "테스트를 통과할 때까지 스스로 수정해라"가 가장 강력한 지시 |
| 7 | **CLAUDE.md를 계속 갱신** | 반복해서 지적한 실수는 규칙으로 승격시킬 것 |

## F-2. 막혔을 때 쓰는 디버그 프롬프트 템플릿

```
현재 증상: [정확히 무엇이 잘못되었는지 — 스크린샷이나 에러 로그 첨부]
기대 동작: [어떻게 되어야 하는지]
이미 시도한 것: [ ... ]

다음 순서로 진행해라:
1. 관련 파일만 읽어라. 다른 파일은 건드리지 마라.
2. 원인 가설을 3개 제시하고, 각각을 어떻게 검증할지 설명해라.
3. 내 승인을 받은 뒤 가장 가능성 높은 것부터 수정해라.
4. 수정 후 이 버그를 재현하는 테스트를 추가해라.
```

## F-3. 리팩터링 폭주 방지

AI는 요청하지 않은 파일까지 "개선"하려는 경향이 있습니다. 이를 막는 문구:

```
이번 작업의 범위는 `app/journal/` 과 `lib/domain/process-score.ts` 뿐이다.
다른 파일은 읽어도 되지만 수정하지 마라.
개선이 필요해 보이는 다른 파일이 있으면 목록으로만 보고하고,
직접 고치지 마라.
```

## F-4. 컨텍스트 관리

- Phase가 바뀔 때마다 **새 세션**을 시작하십시오. 긴 대화는 품질을 떨어뜨립니다.
- 새 세션 시작 시 첫 메시지: `CLAUDE.md와 docs/SPEC.md를 먼저 읽어라. 그 다음 Phase N을 진행한다.`
- 도메인 용어가 흔들리면 `docs/DOMAIN.md`를 만들어 R-multiple, processScore 정의를 고정하십시오.

## F-5. 검증 우선순위 (직접 눈으로 볼 것)

AI가 "완료했습니다"라고 해도 아래 5가지는 **반드시 직접** 확인하십시오.

1. **미래 데이터 누출** — 리플레이/백테스트에서 개발자도구 네트워크 탭 확인
2. **RLS** — 다른 계정으로 로그인해 데이터가 안 보이는지 확인
3. **API 키 노출** — 빌드 산출물에서 `grep -r "sk-ant" .next/` 로 검색
4. **R 계산 정확성** — 손으로 계산한 값 3건과 대조
5. **저널 잠금** — 저장 후 DB에서 직접 UPDATE가 막히는지 (서버 액션 재검증)

---

# PART G. 법적·윤리적 가드레일

> ⚠️ 저는 변호사가 아닙니다. 아래는 일반적 정보이며, 유료화나 외부 공개 전에는 반드시 금융 규제 전문 변호사에게 확인하십시오.

## G-1. 한국 규제 지형 (2024.8.14 시행 개정 자본시장법)

2024년 8월 14일부터 유사투자자문업자의 범위·영업·진입퇴출 규제를 정비한 개정 자본시장법과 시행령이 시행되고 있습니다. 개인이 투자 관련 서비스를 만들 때 반드시 알아야 할 구분은 다음과 같습니다.

| 구분 | 요건 | 이 프로젝트와의 관계 |
|---|---|---|
| **일반 소프트웨어/도구** | 규제 없음 | ✅ **여기를 목표로 설계됨** |
| **유사투자자문업** | 금융위 **신고**제 (진입요건 사실상 없음), 다만 일방향 채널 영업만 허용 | ⚠️ 불특정다수 대상 유료 투자조언 시 해당 |
| **투자자문업** | 금융위 **등록** 필요 (자본금·인력 요건) | 🚫 개인 개발자가 감당 어려움 |

**가장 중요한 함정 하나**: 개정법에 따르면, 개별 투자자를 상정하지 않고 다수인을 대상으로 일방향으로 하는 투자 조언이라도, **온라인에서 대가를 지불한 고객과 의견을 교환할 수 있는 형태**면 투자자문업으로 보게 됩니다.

> 👉 **직결되는 결론**: **유료 구독 + AI 챗봇이 개별 종목에 대해 양방향으로 답변**하는 조합은 투자자문업에 해당할 위험이 큽니다.
> 이것이 M10(AI 코치)의 시스템 프롬프트에서 **종목 언급·가격 예측·시황 단정을 전면 금지**한 실질적 이유입니다. 코치는 사용자의 **과거 행동 패턴**만 다루고, **미래 종목 전망은 일절 다루지 않습니다.**

또한 유사투자자문업자에게는 금융회사로 오인하게 하는 표시·광고, 손실보전이나 이익보장으로 오해하게 만드는 표시·광고가 금지되고, 광고 시 개별 투자상담이 불가하다는 점, 원금 손실 가능성과 손실 귀속, 정식 금융투자업자가 아니라는 점을 알려야 합니다.

## G-2. 안전 설계 체크리스트

| 항목 | 안전 (권장) | 위험 (회피) |
|---|---|---|
| 콘텐츠 | 사용자 **본인 과거 거래** 분석 | 종목 전망·추천 |
| AI 출력 | 질문·개념 설명·행동 패턴 | 매수/매도 의견, 목표주가 |
| 시황 | 언급하지 않음 | "지금은 상승장" |
| 성과 표시 | 프로세스 점수, R 분포 | "이 전략 수익률 300%" |
| 소셜 | 프로세스 점수 공유(선택) | 수익률 랭킹 |
| 백테스트 | 사용자가 직접 정의한 규칙 검증 | 서비스가 만든 "추천 전략" 제공 |
| 수익모델 | 도구 사용료(SaaS) | 정보 제공 대가 |

## G-3. 데이터 라이선스

| 소스 | 상업적 이용 |
|---|---|
| KRX 시세 (pykrx 경유) | 개인·연구 목적은 통상 문제없음. **재배포·상업 서비스는 KRX 정보 이용 계약 확인 필요** |
| KIS OpenAPI | 이용약관에 따라 본인 계좌 목적 사용. 서비스 제공 시 제휴 문의 필요 |
| DART | 공공데이터, 출처 표시 권장 |
| lightweight-charts | Apache-2.0 (상업 이용 가능, 고지 필요) |

> 💡 **현실적 조언**: 처음에는 **본인 전용 도구**로 만드십시오. 개인 사용에는 규제·라이선스 이슈가 사실상 없습니다. 검증이 끝난 뒤 공개·유료화를 검토하는 편이 훨씬 안전하고 빠릅니다.

## G-4. 이용자 보호 장치 (제품 내장)

1. 모든 페이지 하단 고정 면책 문구
2. 온보딩에서 "이 도구는 수익을 보장하지 않으며, 개인 투자자 다수가 손실을 봅니다" 명시적 고지 + 확인 체크박스
3. 과도 사용 감지 — 하루 거래 20건 초과 또는 3연속 손실 후 즉시 신규 진입 시 개입 배너:
   `"오늘 {n}번째 거래입니다. 통계적으로 거래 빈도와 수익률은 음의 상관을 보입니다. 잠시 멈추시겠습니까?"`
4. 계좌 -20% 도달 시 리스크랩 강제 안내 (사이징 재검토 유도)
5. 손실 관련 정서적 어려움이 느껴지는 문구를 사용자가 반복 입력할 경우, 성과 지표를 강조하는 대신 휴식을 권하는 톤으로 전환

---

# 부록. 12주 실행 로드맵

| 주차 | Phase | 산출물 | 이 시점의 "쓸 수 있는가?" |
|---|---|---|---|
| 1 | Phase 0~1 | CLAUDE.md, 도메인 순수함수 + 테스트 | ❌ (기반) |
| 2 | Phase 2 | DB, 인증, 설정 | ❌ |
| 3~4 | Phase 3 | **M1 의사결정 저널** | ✅ **여기서부터 실제 사용 시작** |
| 5 | Phase 4 | M2 스코어카드 + M3 R 대시보드 | ✅ 핵심 루프 완성 |
| 6 | 데이터 수집기 | pykrx 백필 + cron | ✅ |
| 7 | Phase 5 | M4 편향 레이더 + M6 반사실 | ✅ 강력한 각성 순간 |
| 8~9 | Phase 6 | **M7 바 리플레이** | ✅ 훈련 도구 완성 |
| 10 | Phase 7 | M9 룰 백테스터 | ✅ |
| 11 | Phase 8 | M10 AI 코치 | ✅ |
| 12 | Phase 9~10 | M5/M8/M11/M12 + 통합·온보딩 | ✅ 완성 |

> 🎯 **가장 중요한 조언**: **3주차에 M1이 완성되면 즉시 본인 실전 매매에 쓰기 시작하십시오.**
> 나머지 모듈을 만드는 9주 동안 데이터가 쌓입니다. 12주 뒤 대시보드를 켜면 **본인의 실제 거래 60~80건**이 분석된 상태로 나옵니다.
> 반대로 다 만든 뒤 쓰기 시작하면, 완성 시점에 표본 0건이라 모든 화면이 비어 있습니다. **데이터 축적을 개발과 병행하는 것이 이 프로젝트의 핵심 전략입니다.**

---

## 최소 실행 버전 (시간이 없다면)

3주가 아니라 **주말 이틀**만 쓸 수 있다면, 아래 3개만 만드십시오. 효용의 70%가 여기 있습니다.

1. **M1 의사결정 저널** — 무효화 조건 + 확신도 + 사후 수정 잠금
2. **M3 R 대시보드** — 기대값, R 히스토그램, 표본 신뢰구간
3. **M2 2×2 산점도** — 프로세스 vs 결과

나머지 9개 모듈은 이 3개가 실제로 습관이 된 뒤에 붙여도 늦지 않습니다.

---

*문서 버전 1.0 · 이 문서는 투자자문이 아니며, 투자 판단과 그 결과는 이용자 본인에게 귀속됩니다.*
