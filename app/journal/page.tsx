import { and, desc, eq, gte, SQL } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import { trades } from "@/lib/db/schema";
import type { SetupType, SourceType } from "@/lib/domain/types";
import { QUADRANT_LABELS, SETUP_LABELS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

const PERIOD_DAYS: Record<string, number> = {
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 365,
};

function FilterLink({
  searchParams,
  paramKey,
  value,
  label,
  active,
}: {
  searchParams: Record<string, string | undefined>;
  paramKey: string;
  value: string | undefined;
  label: string;
  active: boolean;
}) {
  const next = new URLSearchParams(
    Object.entries(searchParams).filter(([, v]) => v !== undefined) as [
      string,
      string,
    ][]
  );
  if (value === undefined) {
    next.delete(paramKey);
  } else {
    next.set(paramKey, value);
  }
  const qs = next.toString();
  return (
    <Link href={qs ? `/journal?${qs}` : "/journal"}>
      <Badge variant={active ? "default" : "outline"}>{label}</Badge>
    </Link>
  );
}

export default async function JournalListPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string;
    setup?: string;
    quadrant?: string;
    source?: string;
  }>;
}) {
  const params = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const conditions: SQL[] = [eq(trades.userId, user.id)];

  if (params.period && PERIOD_DAYS[params.period]) {
    const since = new Date();
    since.setDate(since.getDate() - PERIOD_DAYS[params.period]);
    conditions.push(gte(trades.entryAt, since));
  }
  if (params.setup) {
    conditions.push(eq(trades.setup, params.setup as SetupType));
  }
  if (params.quadrant) {
    conditions.push(eq(trades.quadrant, params.quadrant));
  }
  if (params.source) {
    conditions.push(eq(trades.source, params.source as SourceType));
  } else {
    conditions.push(eq(trades.source, "live"));
  }

  const rows = await db
    .select()
    .from(trades)
    .where(and(...conditions))
    .orderBy(desc(trades.entryAt));

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">저널</h1>
        <Button render={<Link href="/journal/new">새 저널 작성</Link>} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">기간:</span>
        <FilterLink searchParams={params} paramKey="period" value={undefined} label="전체" active={!params.period} />
        {Object.keys(PERIOD_DAYS).map((p) => (
          <FilterLink
            key={p}
            searchParams={params}
            paramKey="period"
            value={p}
            label={p}
            active={params.period === p}
          />
        ))}

        <span className="ml-4 text-sm text-muted-foreground">데이터:</span>
        <FilterLink searchParams={params} paramKey="source" value={undefined} label="실전" active={!params.source || params.source === "live"} />
        <FilterLink searchParams={params} paramKey="source" value="replay" label="리플레이" active={params.source === "replay"} />
        <FilterLink searchParams={params} paramKey="source" value="drill" label="드릴" active={params.source === "drill"} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">사분면:</span>
        <FilterLink searchParams={params} paramKey="quadrant" value={undefined} label="전체" active={!params.quadrant} />
        {Object.entries(QUADRANT_LABELS).map(([value, label]) => (
          <FilterLink
            key={value}
            searchParams={params}
            paramKey="quadrant"
            value={value}
            label={label}
            active={params.quadrant === value}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">셋업:</span>
        <FilterLink searchParams={params} paramKey="setup" value={undefined} label="전체" active={!params.setup} />
        {Object.entries(SETUP_LABELS).map(([value, label]) => (
          <FilterLink
            key={value}
            searchParams={params}
            paramKey="setup"
            value={value}
            label={label}
            active={params.setup === value}
          />
        ))}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>날짜</TableHead>
            <TableHead>종목</TableHead>
            <TableHead>셋업</TableHead>
            <TableHead>확신도</TableHead>
            <TableHead>실현R</TableHead>
            <TableHead>프로세스</TableHead>
            <TableHead>사분면</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                저널이 없습니다.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <Link href={`/journal/${t.id}`} className="hover:underline">
                    {t.entryAt ? new Date(t.entryAt).toLocaleDateString("ko-KR") : "—"}
                  </Link>
                </TableCell>
                <TableCell>{t.ticker ?? t.maskedLabel}</TableCell>
                <TableCell>{SETUP_LABELS[t.setup]}</TableCell>
                <TableCell>{t.confidence}%</TableCell>
                <TableCell>{t.realizedR !== null ? `${t.realizedR.toFixed(2)}R` : "—"}</TableCell>
                <TableCell>{t.processScore ?? "—"}</TableCell>
                <TableCell>
                  {t.quadrant ? (
                    <Badge>{QUADRANT_LABELS[t.quadrant as keyof typeof QUADRANT_LABELS]}</Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
