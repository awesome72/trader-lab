import { NextResponse } from "next/server";
import { exportTradesAsCsv } from "@/lib/queries/export";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const csv = await exportTradesAsCsv(user.id);
  const filename = `traderlab-trades-${new Date().toISOString().slice(0, 10)}.csv`;

  // BOM so Excel opens UTF-8 Korean text correctly instead of mangling it.
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
