import { Resend } from "resend";

export interface WeeklyDigestData {
  thisWeekScore: number | null;
  lastWeekScore: number | null;
  dueCardCount: number;
  experiment: { rule: string; compliant: number; total: number } | null;
  siteUrl: string;
}

function fmtScore(v: number | null): string {
  return v !== null ? v.toFixed(0) : "—";
}

// Pure content builder — kept separate from the actual Resend call so the
// copy can be unit-tested without network access. Reuses the exact numbers
// the home dashboard shows (see lib/queries/dashboard.ts,
// lib/queries/srs.ts, lib/queries/coach.ts) so the email is never a
// second, drifting source of truth.
export function buildWeeklyDigestEmail(data: WeeklyDigestData): {
  subject: string;
  html: string;
  text: string;
} {
  const scoreLine =
    data.thisWeekScore !== null
      ? `이번 주 평균 프로세스 점수: ${fmtScore(data.thisWeekScore)} (지난주 ${fmtScore(data.lastWeekScore)})`
      : "이번 주 청산된 거래가 없습니다.";

  const cardLine =
    data.dueCardCount > 0
      ? `복습 대기 카드 ${data.dueCardCount}장이 쌓여 있습니다.`
      : "복습할 카드가 없습니다 — 잘 유지하고 있습니다.";

  const experimentLine = data.experiment
    ? `진행 중인 실험 "${data.experiment.rule}": 최근 ${data.experiment.total}거래 중 ${data.experiment.compliant}회 준수.`
    : null;

  const lines = [scoreLine, cardLine, experimentLine].filter((l): l is string => l !== null);

  const subject = "TraderLab 주간 요약";
  const text = [
    "이번 주 TraderLab 요약입니다.",
    "",
    ...lines,
    "",
    `자세히 보기: ${data.siteUrl}`,
    "",
    "이 메일은 투자자문이 아니며, 알림을 원하지 않으면 설정 페이지에서 끌 수 있습니다.",
  ].join("\n");

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>이번 주 TraderLab 요약</h2>
      <ul>${lines.map((l) => `<li>${l}</li>`).join("")}</ul>
      <p><a href="${data.siteUrl}">자세히 보기</a></p>
      <p style="color: #888; font-size: 12px;">
        이 메일은 투자자문이 아니며, 알림을 원하지 않으면 설정 페이지에서 끌 수 있습니다.
      </p>
    </div>
  `.trim();

  return { subject, html, text };
}

// Skips (with a warning, not a throw) when RESEND_KEY isn't configured
// yet, so the weekly-digest cron route stays safe to deploy/run before the
// key is provisioned rather than 500ing every call.
export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const apiKey = process.env.RESEND_KEY;
  if (!apiKey) {
    console.warn("RESEND_KEY not set — skipping email send to", to);
    return false;
  }

  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM_EMAIL ?? "TraderLab <onboarding@resend.dev>";

  const { error } = await resend.emails.send({ from, to, subject, html, text });
  if (error) {
    console.error("Resend send failed:", error);
    return false;
  }
  return true;
}
