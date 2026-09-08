import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

// A once-per-account explainer of the app's actual mechanism: it's not a
// one-shot tool, it's a loop that always returns to the home screen. Ported
// from a design draft into the app's own design system (grayscale, no
// accent color — see app/globals.css) rather than linking out to an
// external page, so every signed-up trader can see it, not just the owner.
const STEPS: { title: string; path: string | null; body: string }[] = [
  {
    title: "홈",
    path: "/",
    body: "이번 주 프로세스 점수(전주 대비), 가장 위험한 편향, 오늘의 복습 카드 수, 최근 거래 5건과 모든 기능으로 가는 바로가기가 모여 있는 허브입니다. 계좌 수익률이 아니라 프로세스 점수가 가장 크게 보이는 것이 의도적인 설계입니다.",
  },
  {
    title: "저널 작성",
    path: "/journal/new",
    body: "매매를 실행하기 전에 진입 논거(50자+), 무효화 조건(20자+), 손절가·목표가·확신도를 미리 선언합니다. 저장 즉시 잠기고 이후 수정할 수 없습니다 — 사후에 기억을 미화하는 것을 막기 위해서입니다.",
  },
  {
    title: "청산 기록",
    path: "/journal/[id]/close",
    body: "포지션을 정리한 뒤 청산가·사유를 입력합니다. 수집기가 이미 백필한 종목이면 보유 중 최저·최고가가 실제 시세로 자동 채워집니다.",
  },
  {
    title: "자동 채점",
    path: null,
    body: "결과와 완전히 독립적인 프로세스 점수(0~100)와, 실력·행운·불운·실수 중 어느 사분면에 해당하는지가 그 자리에서 자동으로 계산됩니다. 사람이 손대는 단계가 아닙니다.",
  },
  {
    title: "피드백 확인",
    path: "/scorecard, /metrics, /bias",
    body: "과정과 결과가 실제로 연결되어 있는지(상관계수), R-multiple 기준 핵심 지표, 처분효과·보복매매 같은 행동 패턴을 숫자로 확인합니다. 거래가 없으면 “샘플로 미리보기”로 먼저 감을 잡을 수 있습니다.",
  },
  {
    title: "AI 코치",
    path: "/coach",
    body: "답을 주는 대신 관찰·질문·행동재무학 개념·검증 가능한 실험 1개를 제시합니다. 여기서 나온 실험이 다음 저널 작성의 판단 기준이 되면서 루프가 다시 시작됩니다.",
  },
];

function DiagramNode({
  x,
  y,
  w = 150,
  h = 60,
  num,
  title,
  subtitle,
  hub = false,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  num: number;
  title: string;
  subtitle: string;
  hub?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={14}
        className={hub ? "fill-primary stroke-primary" : "fill-background stroke-border"}
        strokeWidth={1.5}
      />
      <text
        x={x + w / 2}
        y={y + h / 2 - 6}
        textAnchor="middle"
        className={hub ? "fill-primary-foreground" : "fill-foreground"}
        style={{ fontSize: 14.5, fontWeight: 600 }}
      >
        {title}
      </text>
      <text
        x={x + w / 2}
        y={y + h / 2 + 13}
        textAnchor="middle"
        className={hub ? "fill-primary-foreground/70" : "fill-muted-foreground"}
        style={{ fontSize: 11 }}
      >
        {subtitle}
      </text>
      <circle cx={x + 12} cy={y - 12} r={12} className="fill-foreground" />
      <text
        x={x + 12}
        y={y - 8}
        textAnchor="middle"
        className="fill-background"
        style={{ fontSize: 12, fontWeight: 600 }}
      >
        {num}
      </text>
    </g>
  );
}

export default async function GuidePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">매매 훈련 루프</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          트레이더랩은 한 번 쓰고 끝나는 도구가 아니라, 계획 → 실행 → 채점 →
          피드백 → 회고가 홈 화면을 중심으로 반복되는 순환 구조입니다.
        </p>
      </div>

      <Card>
        <CardContent className="overflow-x-auto pt-6">
          <svg
            viewBox="0 0 900 620"
            role="img"
            aria-label="홈 화면을 중심으로 저널 작성, 청산 기록, 자동 채점, 피드백 확인, AI 코치를 거쳐 다시 홈으로 돌아오는 6단계 순환 흐름. 홈은 훈련 모드(리플레이·드릴·백테스터·캘리브레이션·리스크랩) 및 매주 월요일 발송되는 주간 요약 이메일과도 점선으로 연결된다."
            className="min-w-[720px]"
          >
            <defs>
              <marker id="g-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <polygon points="0,0 10,5 0,10" className="fill-foreground" />
              </marker>
              <marker id="g-arrow-muted" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <polygon points="0,0 10,5 0,10" className="fill-muted-foreground" />
              </marker>
            </defs>

            {/* main cycle edges */}
            <line x1="616" y1="192" x2="655" y2="215" className="stroke-foreground" strokeWidth={2.25} markerEnd="url(#g-arrow)" />
            <text x="660" y="188" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 11.5 }}>계획 수립</text>

            <line x1="716" y1="315" x2="716" y2="365" className="stroke-foreground" strokeWidth={2.25} markerEnd="url(#g-arrow)" />
            <text x="794" y="345" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 11.5 }}>실제 매매 체결</text>

            <line x1="660" y1="462" x2="620" y2="484" className="stroke-foreground" strokeWidth={2.25} markerEnd="url(#g-arrow)" />
            <text x="660" y="510" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 11.5 }}>결과 입력</text>

            <line x1="504" y1="488" x2="464" y2="465" className="stroke-foreground" strokeWidth={2.25} markerEnd="url(#g-arrow)" />
            <text x="452" y="500" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 11.5 }}>자동 반영</text>

            <line x1="404" y1="365" x2="404" y2="315" className="stroke-foreground" strokeWidth={2.25} markerEnd="url(#g-arrow)" />
            <text x="326" y="345" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 11.5 }}>회고 요청</text>

            <line x1="460" y1="217" x2="500" y2="194" className="stroke-foreground" strokeWidth={2.25} markerEnd="url(#g-arrow)" />
            <text x="460" y="188" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 11.5 }}>다음 매매로</text>

            {/* side edges (dashed) */}
            <line x1="300" y1="146" x2="482" y2="146" className="stroke-muted-foreground" strokeWidth={1.75} strokeDasharray="5 5" markerEnd="url(#g-arrow-muted)" />
            <text x="391" y="134" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 11.5 }}>연습하기</text>
            <line x1="482" y1="176" x2="300" y2="176" className="stroke-muted-foreground" strokeWidth={1.75} strokeDasharray="5 5" markerEnd="url(#g-arrow-muted)" />
            <text x="391" y="198" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 11.5 }}>실력 향상</text>

            <line x1="560" y1="74" x2="560" y2="128" className="stroke-muted-foreground" strokeWidth={1.75} strokeDasharray="5 5" markerEnd="url(#g-arrow-muted)" />
            <text x="628" y="105" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 11.5 }}>매주 월요일 08:00</text>

            {/* side boxes */}
            <g>
              <rect x="40" y="100" width="260" height="120" rx="14" className="fill-muted stroke-border" strokeWidth={1.5} strokeDasharray="4 3" />
              <text x="170" y="130" textAnchor="middle" className="fill-foreground" style={{ fontSize: 13.5, fontWeight: 600 }}>훈련 모드</text>
              <text x="170" y="155" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 11 }}>실전 매매 없이 연습</text>
              <text x="170" y="176" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 11 }}>리플레이 · 드릴 · 백테스터</text>
              <text x="170" y="195" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 11 }}>캘리브레이션 · 리스크랩</text>
            </g>
            <g>
              <rect x="470" y="24" width="180" height="50" rx="25" className="fill-muted stroke-border" strokeWidth={1.5} strokeDasharray="4 3" />
              <text x="560" y="54" textAnchor="middle" className="fill-foreground" style={{ fontSize: 12.5, fontWeight: 600 }}>주간 요약 이메일</text>
            </g>

            {/* nodes */}
            <DiagramNode x={485} y={130} num={1} title="홈" subtitle="이번 주 점수 · 바로가기" hub />
            <DiagramNode x={641} y={220} num={2} title="저널 작성" subtitle="논거 · 손절가 선언" />
            <DiagramNode x={641} y={400} num={3} title="청산 기록" subtitle="실제 결과 입력" />
            <DiagramNode x={485} y={490} num={4} title="자동 채점" subtitle="프로세스 점수 · 사분면" />
            <DiagramNode x={329} y={400} num={5} title="피드백 확인" subtitle="스코어카드 · 편향레이더" />
            <DiagramNode x={329} y={220} num={6} title="AI 코치" subtitle="소크라테스식 회고" />
          </svg>
          <p className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="inline-block h-0 w-4 border-t-2 border-foreground" /> 매 거래마다 도는 핵심 순환</span>
            <span className="inline-flex items-center gap-1.5"><span className="inline-block h-0 w-4 border-t-2 border-dashed border-muted-foreground" /> 언제든 드나들 수 있는 보조 경로</span>
          </p>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold">6단계 자세히 보기</h2>
        <p className="mt-1 text-sm text-muted-foreground">번호는 다이어그램의 배지 번호와 같습니다.</p>
        <div className="mt-3 space-y-2">
          {STEPS.map((step, i) => (
            <Card key={step.title}>
              <CardContent className="flex gap-4 pt-6">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                  {i + 1}
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">
                    {step.title}
                    {step.path ? <code className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-normal">{step.path}</code> : null}
                  </h3>
                  <p className="text-sm text-muted-foreground">{step.body}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold">루프를 도는 두 가지 보조 경로</h2>
        <p className="mt-1 text-sm text-muted-foreground">홈에서 점선으로 갈라져 나가는 두 갈래는 실전 순환에 끼어들지 않으면서 실력을 채워줍니다.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">훈련 모드</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              리플레이·시나리오 드릴·노코드 백테스터·캘리브레이션 퀴즈·몬테카를로 리스크랩 — 실제 돈이 걸리지 않은 상태로 판단력과 사이징 감각을 반복 훈련합니다. 결과는 실전 통계와 절대 섞이지 않습니다.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">주간 요약 이메일</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              매주 월요일 08:00, 이번 주 프로세스 점수와 지난주 비교, 복습 대기 카드 수, 진행 중인 AI 코치 실험의 준수율을 메일로 보내 루프로 다시 데려옵니다. 설정에서 언제든 끌 수 있습니다.
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
