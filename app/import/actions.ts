"use server";

import { redirect } from "next/navigation";
import { importCsvTrades, type CsvImportRow, type CsvImportResult } from "@/lib/queries/import";
import { createClient } from "@/lib/supabase/server";

export async function importTrades(rows: CsvImportRow[]): Promise<CsvImportResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  return importCsvTrades(user.id, rows);
}
