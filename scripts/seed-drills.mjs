// Seeds drill_cards with the 20 scenario cards from docs/SPEC.md Phase 9-B.
// Scoring is process-consistency (does the choice honor a pre-declared
// rule?), never right/wrong and never outcome-based — see
// lib/domain/drills.ts for how scores are read back.
//
// Usage: npm run db:seed-drills
import postgres from "postgres";

try {
  process.loadEnvFile(".env.local");
} catch {
  // optional in CI
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set (check .env.local)");
}

function card(code, title, situation, options, scoringRubric, conceptTags) {
  return { code, title, situation, options, scoringRubric, conceptTags };
}

const CARDS = [
  card(
    "stop-loss-bounce",
    "손절직전반등",
    { holdingState: "보유 중, 진입가 50,000원 / 손절가 47,000원", priceContext: "현재가 47,100원, 손절가까지 0.2% 남음", timing: "장중 14:30", marketContext: "코스피 보합" },
    [
      { key: "A", label: "계획대로 손절가에서 매도" },
      { key: "B", label: "반등할 것 같아 손절가를 46,000원으로 낮춰서 더 기다린다" },
      { key: "C", label: "일단 절반만 손절하고 나머지는 지켜본다" },
      { key: "D", label: "반등을 확신하고 추가매수해 평단을 낮춘다" },
    ],
    {
      A: { score: 100, explanation: "진입 시 선언한 손절 규칙을 예외 없이 지킨다는 전제입니다." },
      B: { score: 10, explanation: "손절가를 사후에 유리한 쪽으로 옮겨도 된다는 전제입니다." },
      C: { score: 40, explanation: "계획에 없던 부분청산이라는 재량을 그때그때 허용한다는 전제입니다." },
      D: { score: 0, explanation: "손실 중인 포지션에 물타기로 리스크를 키워도 된다는 전제입니다." },
    },
    ["손실회피", "매몰비용", "사전공약"]
  ),
  card(
    "target-1pct-stall",
    "목표가1%앞정체",
    { holdingState: "보유 중, +2.8R, 목표 +3R", priceContext: "목표가 1% 앞에서 3거래일째 정체", timing: "장 마감 후", marketContext: "특별 이슈 없음" },
    [
      { key: "A", label: "목표가 도달까지 계획대로 대기한다" },
      { key: "B", label: "지금 전량 익절한다" },
      { key: "C", label: "목표가를 지금 가격으로 낮춰 잡고 '계획을 지켰다'고 기록한다" },
      { key: "D", label: "정체가 답답해 물타기하며 목표를 상향한다" },
    ],
    {
      A: { score: 100, explanation: "사전에 선언한 목표가까지는 재량적 이탈을 하지 않는다는 전제입니다." },
      B: { score: 60, explanation: "계획보다 이른 이익실현이라는 재량을 그때그때 허용한다는 전제입니다." },
      C: { score: 20, explanation: "목표가를 사후에 조작해 규칙을 지킨 것처럼 기록해도 된다는 전제입니다." },
      D: { score: 0, explanation: "정체가 불편하다는 이유로 리스크를 확대해도 된다는 전제입니다." },
    },
    ["처분효과", "앵커링"]
  ),
  card(
    "gap-up-open",
    "갭상승시가",
    { holdingState: "미보유, 관심종목", priceContext: "전일 종가 대비 +6% 갭상승 시가", timing: "장 시작 09:00", marketContext: "특별한 재료 미확인" },
    [
      { key: "A", label: "사전에 정한 진입 조건(예: 종가 확인 후)을 그대로 지켜 시가 추격은 하지 않는다" },
      { key: "B", label: "시가에 즉시 추격매수한다" },
      { key: "C", label: "반전을 노려 계획에 없던 공매도를 시도한다" },
      { key: "D", label: "갭상승 이유를 확인한 뒤 원래 조건이 충족되면 진입한다" },
    ],
    {
      A: { score: 100, explanation: "진입은 사전에 정의된 조건에서만 한다는 전제입니다." },
      B: { score: 10, explanation: "이미 오른 가격을 근거 확인 없이 쫓아가도 된다는 전제입니다." },
      C: { score: 0, explanation: "계획에 없던 방향으로도 즉흥 진입해도 된다는 전제입니다." },
      D: { score: 80, explanation: "조건 재확인은 하되 원래 진입 기준은 유지한다는 전제입니다." },
    },
    ["FOMO", "추격매매"]
  ),
  card(
    "gap-down-open",
    "갭하락시가",
    { holdingState: "보유 중, 손절가 48,000원", priceContext: "시가가 46,500원으로 손절가 아래에서 출발", timing: "장 시작 09:00", marketContext: "야간 악재 뉴스" },
    [
      { key: "A", label: "시가에 즉시 계획대로 손절 매도한다" },
      { key: "B", label: "반등을 기대하며 관망한다" },
      { key: "C", label: "가격이 싸졌다고 판단해 추가매수한다" },
      { key: "D", label: "손절가를 시가 근처로 사후 조정해 '지켰다'고 기록한다" },
    ],
    {
      A: { score: 100, explanation: "손절가가 갭으로 뚫려도 즉시 시장가로 실행한다는 전제입니다." },
      B: { score: 10, explanation: "손절가를 이미 이탈했는데도 재량적으로 보유를 연장해도 된다는 전제입니다." },
      C: { score: 0, explanation: "손실 중 갭리스크가 실현된 상황에서도 물타기를 해도 된다는 전제입니다." },
      D: { score: 5, explanation: "손절가를 사후에 실제 체결가로 바꿔 기록을 왜곡해도 된다는 전제입니다." },
    },
    ["손실회피", "갭리스크"]
  ),
  card(
    "earnings-day-minus-1",
    "실적D-1보유",
    { holdingState: "보유 중", priceContext: "진입 시 이미 실적 발표일을 인지하고 계획을 세움", timing: "실적 발표 하루 전 장 마감", marketContext: "시장 전반 특이사항 없음" },
    [
      { key: "A", label: "실적 발표를 이미 고려한 원래 계획대로 유지·청산 여부를 실행한다" },
      { key: "B", label: "막연히 불안해서 계획에 없던 전량 청산을 한다" },
      { key: "C", label: "발표 전 기대감에 포지션을 즉흥적으로 두 배로 늘린다" },
      { key: "D", label: "실적 서프라이즈를 예측해 베팅성으로 추가매수한다" },
    ],
    {
      A: { score: 100, explanation: "이벤트 리스크는 진입 시점에 이미 계획에 반영되어 있다는 전제입니다." },
      B: { score: 40, explanation: "근거 없는 불안만으로 계획에 없던 조기청산을 해도 된다는 전제입니다." },
      C: { score: 0, explanation: "불확실성이 큰 이벤트 앞에서 오히려 리스크를 키워도 된다는 전제입니다." },
      D: { score: 0, explanation: "실적 결과를 예측할 수 있다고 가정하고 베팅해도 된다는 전제입니다." },
    },
    ["이벤트리스크", "사전공약"]
  ),
  card(
    "near-upper-limit",
    "상한가근접",
    { holdingState: "보유 중, +2R 초과 수익", priceContext: "현재가가 상한가(+30%)에 근접", timing: "장중 10:15", marketContext: "거래량 폭증" },
    [
      { key: "A", label: "사전에 정한 이익실현 규칙(있다면)을 그대로 실행한다" },
      { key: "B", label: "'상한가 굳을 것 같다'는 생각으로 계획에 없이 전량 보유를 연장한다" },
      { key: "C", label: "상한가 근접만 보고 즉흥적으로 추가매수한다" },
      { key: "D", label: "상한가 갈 것 같아 계획에 없이 지금 전량 매도한다" },
    ],
    {
      A: { score: 100, explanation: "급등 상황에서도 사전 규칙 이상의 재량을 쓰지 않는다는 전제입니다." },
      B: { score: 30, explanation: "낙관적 전망만으로 계획에 없던 보유 연장을 해도 된다는 전제입니다." },
      C: { score: 0, explanation: "이미 크게 오른 가격을 근거 없이 추격해도 된다는 전제입니다." },
      D: { score: 40, explanation: "사전 목표 없이도 임의로 조기 이익실현을 해도 된다는 전제입니다." },
    },
    ["FOMO", "처분효과"]
  ),
  card(
    "vi-triggered",
    "VI발동직후",
    { holdingState: "보유 중 또는 관심", priceContext: "변동성완화장치(VI) 발동 후 2분 뒤 재개", timing: "장중", marketContext: "단일 종목 이슈로 추정" },
    [
      { key: "A", label: "재개 직후 변동성이 커진 구간에서는 계획된 조건 재확인 전엔 신규 진입하지 않는다" },
      { key: "B", label: "재개 방향을 예측해 즉흥적으로 진입한다" },
      { key: "C", label: "보유 중이었다면 원래 계획대로만 대응한다" },
      { key: "D", label: "VI 발동 자체를 위험 신호로 보고 계획에 없이 패닉 청산한다" },
    ],
    {
      A: { score: 100, explanation: "비정상적 변동성 구간에서는 조건 재확인 없이 행동하지 않는다는 전제입니다." },
      B: { score: 0, explanation: "예측 불가능한 재개 방향에 즉흥적으로 베팅해도 된다는 전제입니다." },
      C: { score: 100, explanation: "이미 보유 중인 포지션은 사전 규칙 그대로 대응한다는 전제입니다." },
      D: { score: 20, explanation: "변동성 확대 자체를 계획에 없던 조기청산의 근거로 써도 된다는 전제입니다." },
    },
    ["변동성", "사전공약"]
  ),
  card(
    "individual-strength-market-crash",
    "시장급락중개별강세",
    { holdingState: "보유 중, 보유 종목만 강세", priceContext: "코스피 -3%, 보유 종목 +1%", timing: "장중 13:00", marketContext: "시장 전반 급락" },
    [
      { key: "A", label: "계획대로 손절·목표 규칙을 그대로 유지한다" },
      { key: "B", label: "시장이 무서워 계획에 없이 조기 전량 청산한다" },
      { key: "C", label: "시장급락은 무시하고 확신에 차서 추가매수한다" },
      { key: "D", label: "손절가를 시장 상황에 맞춰 더 타이트하게 사후 조정한다" },
    ],
    {
      A: { score: 100, explanation: "시장 전반의 소음과 개별 종목 계획을 분리해서 본다는 전제입니다." },
      B: { score: 40, explanation: "시장 공포만으로 계획에 없던 조기청산을 해도 된다는 전제입니다." },
      C: { score: 10, explanation: "일시적 강세를 근거로 리스크를 더 키워도 된다는 전제입니다." },
      D: { score: 30, explanation: "방향이 보수적이어도 손절가를 사후에 바꿔도 된다는 전제입니다." },
    },
    ["확증편향", "사전공약"]
  ),
  card(
    "three-losses-then-entry",
    "3연속손실후진입",
    { holdingState: "신규 진입 검토", priceContext: "직전 3거래 연속 손절", timing: "새로운 셋업 발생 직후", marketContext: "평소와 동일" },
    [
      { key: "A", label: "평소와 동일한 리스크%·사이징 규칙 그대로 진입한다" },
      { key: "B", label: "손실을 만회하려고 평소보다 큰 사이즈로 진입한다" },
      { key: "C", label: "두려움에 셋업이 유효한데도 진입을 회피한다" },
      { key: "D", label: "사이즈를 줄여서 신중하게 진입한다" },
    ],
    {
      A: { score: 100, explanation: "직전 결과와 무관하게 리스크 규칙은 고정된다는 전제입니다." },
      B: { score: 0, explanation: "손실을 만회하기 위해 사이즈를 키워도 된다는 전제입니다(보복매매)." },
      C: { score: 50, explanation: "유효한 셋업도 감정적으로 회피해도 된다는 전제입니다." },
      D: { score: 70, explanation: "사전 규칙에 없어도 임의로 사이즈를 줄이는 재량을 허용한다는 전제입니다." },
    },
    ["보복매매", "손실회피"]
  ),
  card(
    "plus-2r-trend-continues",
    "+2R도달추세지속",
    { holdingState: "보유 중, +2R, 목표 +3R, 트레일링스탑 규칙 없음", priceContext: "추세 지속 중", timing: "장중", marketContext: "특이사항 없음" },
    [
      { key: "A", label: "사전 목표(+3R)까지 계획대로 유지한다" },
      { key: "B", label: "지금 전량 익절한다" },
      { key: "C", label: "목표를 즉흥적으로 상향하고 추가매수까지 한다" },
      { key: "D", label: "사전 규칙에 없던 손절가 본전 이동을 지금 임의로 추가한다" },
    ],
    {
      A: { score: 100, explanation: "목표가 도달 전까지는 사전 계획을 그대로 따른다는 전제입니다." },
      B: { score: 50, explanation: "목표 도달 전 조기 이익실현이라는 재량을 그때그때 허용한다는 전제입니다." },
      C: { score: 0, explanation: "잘 되고 있다는 이유로 목표와 리스크를 동시에 늘려도 된다는 전제입니다." },
      D: { score: 40, explanation: "사전에 없던 규칙을 상황에 따라 즉흥적으로 추가해도 된다는 전제입니다." },
    },
    ["처분효과", "트레일링스탑"]
  ),
  card(
    "rights-offering-announcement",
    "유상증자공시",
    { holdingState: "보유 중", priceContext: "장중 유상증자 공시", timing: "장중 11:00", marketContext: "해당 종목 급락 중" },
    [
      { key: "A", label: "사전 무효화 조건에 이런 공시가 포함돼 있었다면 그대로 청산하고, 없었다면 계획대로 유지하며 상황을 재평가한다" },
      { key: "B", label: "공시 내용 확인 없이 패닉 청산한다" },
      { key: "C", label: "'저가매수 기회'라며 즉흥적으로 추가매수한다" },
      { key: "D", label: "공시와 무관하게 원래 손절가만 기계적으로 지키고 무효화 조건은 재점검하지 않는다" },
    ],
    {
      A: { score: 100, explanation: "새로운 정보는 사전에 정의된 무효화 조건에 비추어 판단한다는 전제입니다." },
      B: { score: 30, explanation: "내용 확인 없이 즉흥적으로 반응해도 된다는 전제입니다." },
      C: { score: 0, explanation: "악재성 공시를 근거 없이 매수 기회로 재해석해도 된다는 전제입니다." },
      D: { score: 60, explanation: "가격 규칙은 지키되 새로운 정보로 계획을 갱신하지 않아도 된다는 전제입니다." },
    },
    ["무효화조건", "이벤트리스크"]
  ),
  card(
    "foreign-selling-reversal",
    "외국인대량순매도전환",
    { holdingState: "보유 중", priceContext: "외국인 수급이 순매수에서 대량 순매도로 전환", timing: "장중 14:00", marketContext: "가격은 아직 손절가 위" },
    [
      { key: "A", label: "계획된 청산·유지 규칙을 그대로 적용한다" },
      { key: "B", label: "수급 전환만 보고 계획에 없이 즉흥 전량 청산한다" },
      { key: "C", label: "수급 지표를 무시하고 오히려 확신을 갖고 추가매수한다" },
      { key: "D", label: "포지션 절반 축소를 즉흥적으로 결정한다" },
    ],
    {
      A: { score: 100, explanation: "가격이 규칙을 건드리기 전까지는 보조 지표로 계획을 바꾸지 않는다는 전제입니다." },
      B: { score: 40, explanation: "가격 조건과 무관하게 수급 신호만으로 조기청산해도 된다는 전제입니다." },
      C: { score: 10, explanation: "악화된 수급 신호를 무시하고 리스크를 키워도 된다는 전제입니다." },
      D: { score: 55, explanation: "사전 규칙에 없는 부분 축소를 상황에 따라 즉흥적으로 해도 된다는 전제입니다." },
    },
    ["수급", "확증편향"]
  ),
  card(
    "trading-halt-resumed",
    "거래정지해제일",
    { holdingState: "보유 중 (정지 전부터)", priceContext: "거래정지 해제 첫날", timing: "장 시작", marketContext: "정지 기간 중 뉴스 다수" },
    [
      { key: "A", label: "재개 첫날 변동성 급증을 감안한 사전 대응 계획대로만 행동한다" },
      { key: "B", label: "재개 즉시 별다른 근거 없이 시가에 매도한다" },
      { key: "C", label: "정지 기간 뉴스만 보고 근거 없이 확신에 차서 추가매수한다" },
      { key: "D", label: "사전 계획이 없었다면 일단 관망하며 며칠 데이터를 본 후 결정한다" },
    ],
    {
      A: { score: 100, explanation: "비정상적 변동성 국면도 사전 계획의 범위 안에서 대응한다는 전제입니다." },
      B: { score: 30, explanation: "근거 없이 즉흥적으로 매도해도 된다는 전제입니다." },
      C: { score: 0, explanation: "확인되지 않은 뉴스만으로 확신에 찬 베팅을 해도 된다는 전제입니다." },
      D: { score: 70, explanation: "규칙이 없을 때는 신중하게 관망하는 재량을 허용한다는 전제입니다." },
    },
    ["유동성", "변동성"]
  ),
  card(
    "ex-dividend-holding",
    "배당락일보유",
    { holdingState: "보유 중", priceContext: "배당락으로 인한 자연스러운 가격 하락", timing: "배당락일 장 시작", marketContext: "특이사항 없음" },
    [
      { key: "A", label: "배당락으로 인한 하락을 손절 신호로 착각하지 않고 계획대로 대응한다" },
      { key: "B", label: "배당락 하락을 보고 계획에 없이 패닉 손절한다" },
      { key: "C", label: "'싸졌다'며 즉흥적으로 추가매수한다" },
      { key: "D", label: "배당금을 받으려고 원래 계획에 없던 보유 연장을 한다" },
    ],
    {
      A: { score: 100, explanation: "배당락의 기계적 가격 조정과 실제 손절 신호를 구분한다는 전제입니다." },
      B: { score: 20, explanation: "배당락으로 인한 하락을 실제 악재로 오인해도 된다는 전제입니다." },
      C: { score: 10, explanation: "가격 하락의 원인을 확인하지 않고 매수해도 된다는 전제입니다." },
      D: { score: 30, explanation: "배당이라는 별개의 동기로 원래 계획을 사후에 바꿔도 된다는 전제입니다." },
    },
    ["배당락", "프레이밍"]
  ),
  card(
    "index-futures-shock",
    "지수선물급변",
    { holdingState: "보유 중", priceContext: "개장 전 지수선물 급락", timing: "장 시작 전", marketContext: "글로벌 이슈 추정" },
    [
      { key: "A", label: "개별 종목 계획은 그대로 두고 시가 반응을 본 뒤 기존 규칙을 적용한다" },
      { key: "B", label: "지수선물만 보고 계획에 없이 시가 전에 급하게 청산한다" },
      { key: "C", label: "지수 급락을 무시하고 오히려 풀사이즈로 신규 진입한다" },
      { key: "D", label: "사전 규칙에 없었지만 즉흥적으로 신규 진입 사이즈를 절반으로 줄인다" },
    ],
    {
      A: { score: 100, explanation: "시장 전체의 소음에도 개별 종목 규칙을 먼저 적용한다는 전제입니다." },
      B: { score: 30, explanation: "가격이 실제로 반응하기 전에 예측만으로 청산해도 된다는 전제입니다." },
      C: { score: 0, explanation: "시장 전반의 위험 신호를 무시하고 리스크를 키워도 된다는 전제입니다." },
      D: { score: 65, explanation: "사전 규칙에 없는 리스크 축소를 상황에 따라 즉흥적으로 해도 된다는 전제입니다." },
    },
    ["시장리스크", "사전공약"]
  ),
  card(
    "theme-stock-early-chase",
    "테마주초기급등추격",
    { holdingState: "관심종목", priceContext: "테마 이슈로 장중 급등 시작", timing: "장중 10:30", marketContext: "커뮤니티·SNS 화제" },
    [
      { key: "A", label: "사전에 정의된 셋업·진입조건에 맞지 않으면 진입하지 않는다" },
      { key: "B", label: "조건 확인 없이 즉시 추격매수한다" },
      { key: "C", label: "SNS 분위기에 확신을 얻어 소액으로 일단 진입 후 계획은 나중에 세운다" },
      { key: "D", label: "급등이 무서워 원래 계획된 셋업이 나와도 진입을 회피한다" },
    ],
    {
      A: { score: 100, explanation: "진입은 사전 조건 충족 여부로만 결정한다는 전제입니다." },
      B: { score: 0, explanation: "가격이 이미 급등했다는 사실 자체를 진입 근거로 써도 된다는 전제입니다." },
      C: { score: 20, explanation: "계획 없이 먼저 진입하고 계획은 사후에 만들어도 된다는 전제입니다." },
      D: { score: 50, explanation: "유효한 셋업도 두려움으로 회피해도 된다는 전제입니다." },
    },
    ["FOMO", "군집행동"]
  ),
  card(
    "breakeven-exit-temptation",
    "본전청산유혹",
    { holdingState: "보유 중, 한동안 손실이다가 본전 부근 회복", priceContext: "진입가 근처", timing: "장중", marketContext: "특이사항 없음" },
    [
      { key: "A", label: "사전 계획(손절가·목표가)대로 유지한다" },
      { key: "B", label: "'본전이니 일단 나가자'며 계획에 없이 즉시 전량 청산한다" },
      { key: "C", label: "본전 회복을 기회로 오히려 물타기를 확대한다" },
      { key: "D", label: "사전 규칙 없이 즉흥적으로 손절가를 더 낮춰 리스크를 늘린다" },
    ],
    {
      A: { score: 100, explanation: "본전이라는 심리적 기준점과 무관하게 사전 계획을 유지한다는 전제입니다." },
      B: { score: 40, explanation: "손실 회피 심리만으로 계획에 없던 조기청산을 해도 된다는 전제입니다." },
      C: { score: 0, explanation: "본전 회복을 근거로 리스크를 더 키워도 된다는 전제입니다." },
      D: { score: 10, explanation: "사전 규칙 없이 손절 폭을 즉흥적으로 늘려도 된다는 전제입니다." },
    },
    ["손익분기점편향", "처분효과"]
  ),
  card(
    "sizing-after-account-high",
    "계좌신고점직후사이징",
    { holdingState: "신규 진입 검토", priceContext: "계좌가 방금 신고점 경신", timing: "신규 셋업 발생 직후", marketContext: "특이사항 없음" },
    [
      { key: "A", label: "신고점과 무관하게 정해진 리스크% 규칙을 그대로 적용한다" },
      { key: "B", label: "자신감이 붙어 평소보다 큰 사이즈로 진입한다" },
      { key: "C", label: "신고점을 지키자며 리스크%를 즉흥적으로 줄인다" },
      { key: "D", label: "신고점 경신을 축하하며 여러 종목에 동시에 사이즈를 늘려 진입한다" },
    ],
    {
      A: { score: 100, explanation: "계좌 성과와 무관하게 리스크 규칙은 고정된다는 전제입니다." },
      B: { score: 0, explanation: "최근 성과가 좋았다는 이유로 사이즈를 키워도 된다는 전제입니다(과신)." },
      C: { score: 55, explanation: "사전 규칙에 없는 리스크 축소를 즉흥적으로 해도 된다는 전제입니다." },
      D: { score: 0, explanation: "여러 포지션에 동시에 리스크를 확대해도 된다는 전제입니다." },
    },
    ["과신", "하우스머니효과"]
  ),
  card(
    "unfilled-order-before-close",
    "마감5분전미체결",
    { holdingState: "신규 진입 지정가 주문 미체결", priceContext: "지정가에서 소폭 벗어난 상태", timing: "장 마감 5분 전", marketContext: "특이사항 없음" },
    [
      { key: "A", label: "사전 계획된 가격 조건을 벗어나 시장가로 쫓아가지 않고 미체결로 둔다" },
      { key: "B", label: "마감 직전 시장가로 급하게 체결시킨다" },
      { key: "C", label: "다음날 재평가 없이 가격만 살짝 올려 반드시 체결시키려 한다" },
      { key: "D", label: "미체결을 핑계로 계획에 없던 다른 종목으로 갈아탄다" },
    ],
    {
      A: { score: 100, explanation: "체결은 사전에 정한 가격 조건 안에서만 이뤄진다는 전제입니다." },
      B: { score: 20, explanation: "시간에 쫓겨 가격 조건을 포기해도 된다는 전제입니다." },
      C: { score: 30, explanation: "체결 자체를 목적으로 가격 조건을 슬쩍 완화해도 된다는 전제입니다." },
      D: { score: 10, explanation: "미체결을 계기로 계획에 없던 종목으로 즉흥 전환해도 된다는 전제입니다." },
    },
    ["사전공약", "앵커링"]
  ),
  card(
    "holiday-position-hold",
    "연휴전포지션유지",
    { holdingState: "보유 중", priceContext: "긴 연휴 직전", timing: "연휴 전 마지막 거래일 장 마감", marketContext: "특이사항 없음" },
    [
      { key: "A", label: "진입 시 연휴 리스크를 이미 고려한 계획대로 유지·축소한다" },
      { key: "B", label: "연휴가 갑자기 신경쓰여 계획에 없이 전량 청산한다" },
      { key: "C", label: "연휴 갭 리스크를 무시하고 오히려 사이즈를 늘린다" },
      { key: "D", label: "연휴 리스크 관리 규칙이 없었다면 즉흥적으로 절반만 청산한다" },
    ],
    {
      A: { score: 100, explanation: "예정된 휴장 리스크는 진입 시점에 이미 계획에 반영돼 있다는 전제입니다." },
      B: { score: 40, explanation: "막연한 불안만으로 계획에 없던 전량 청산을 해도 된다는 전제입니다." },
      C: { score: 0, explanation: "휴장 중 갭 리스크가 커지는 상황에서 오히려 리스크를 키워도 된다는 전제입니다." },
      D: { score: 55, explanation: "사전 규칙이 없을 때 임의로 절반 축소하는 재량을 허용한다는 전제입니다." },
    },
    ["갭리스크", "사전공약"]
  ),
];

async function main() {
  const sql = postgres(process.env.DATABASE_URL, { prepare: false });
  try {
    for (const c of CARDS) {
      await sql`
        INSERT INTO drill_cards (code, title, situation, options, scoring_rubric, concept_tags)
        VALUES (${c.code}, ${c.title}, ${sql.json(c.situation)}, ${sql.json(c.options)},
                ${sql.json(c.scoringRubric)}, ${c.conceptTags})
        ON CONFLICT (code) DO UPDATE SET
          title = excluded.title,
          situation = excluded.situation,
          options = excluded.options,
          scoring_rubric = excluded.scoring_rubric,
          concept_tags = excluded.concept_tags
      `;
    }
    console.log(`seeded ${CARDS.length} drill cards`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
