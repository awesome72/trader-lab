"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parseCsv } from "@/lib/csv";
import type { CsvImportResult } from "@/lib/queries/import";
import { importTrades } from "./actions";

const FIELDS = [
  { key: "ticker", label: "종목명/코드" },
  { key: "entryDate", label: "매수일시" },
  { key: "entryPrice", label: "매수가" },
  { key: "quantity", label: "수량" },
  { key: "exitDate", label: "매도일시" },
  { key: "exitPrice", label: "매도가" },
] as const;
type FieldKey = (typeof FIELDS)[number]["key"];

const NONE = "__none__";

export function ImportClient() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, string>>({
    ticker: NONE,
    entryDate: NONE,
    entryPrice: NONE,
    quantity: NONE,
    exitDate: NONE,
    exitPrice: NONE,
  });
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [encoding, setEncoding] = useState<"utf-8" | "euc-kr">("utf-8");
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<CsvImportResult | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setResult(null);
    try {
      const buffer = await file.arrayBuffer();
      const text = new TextDecoder(encoding).decode(buffer);
      const parsed = parseCsv(text);
      if (parsed.headers.length === 0) {
        setError("헤더 행을 찾을 수 없습니다.");
        return;
      }
      setHeaders(parsed.headers);
      setRows(parsed.rows);
    } catch {
      setError("파일을 읽을 수 없습니다. 인코딩을 바꿔서 다시 시도해보세요.");
    }
  }

  const allMapped = FIELDS.every((f) => mapping[f.key] !== NONE);

  function buildRow(row: string[]): { ticker: string; direction: "long" | "short"; entryDate: string; entryPrice: number; quantity: number; exitDate: string; exitPrice: number } {
    const get = (key: FieldKey) => {
      const idx = headers.indexOf(mapping[key]);
      return idx >= 0 ? row[idx] : "";
    };
    return {
      ticker: get("ticker"),
      direction,
      entryDate: get("entryDate"),
      entryPrice: Number(get("entryPrice").replace(/,/g, "")),
      quantity: Number(get("quantity").replace(/,/g, "")),
      exitDate: get("exitDate"),
      exitPrice: Number(get("exitPrice").replace(/,/g, "")),
    };
  }

  async function handleImport() {
    setImporting(true);
    setResult(null);
    const mappedRows = rows.map(buildRow);
    const res = await importTrades(mappedRows);
    setResult(res);
    setImporting(false);
    if (res.imported > 0) toast.success(`${res.imported}건 임포트 완료`);
    if (res.errors.length > 0) toast.error(`${res.errors.length}건은 건너뛰었습니다`);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">1. 파일 업로드</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
              className="text-sm"
            />
            <Select value={encoding} onValueChange={(v) => v && setEncoding(v as "utf-8" | "euc-kr")}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="utf-8">UTF-8</SelectItem>
                <SelectItem value="euc-kr">EUC-KR (한글 깨짐 시)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {headers.length > 0 ? <p className="text-sm text-muted-foreground">{rows.length}행 감지됨. 인코딩이 깨져 보이면 위에서 EUC-KR로 바꿔 다시 업로드하세요.</p> : null}
        </CardContent>
      </Card>

      {headers.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">2. 컬럼 매핑</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {FIELDS.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">{f.label}</label>
                  <Select
                    value={mapping[f.key]}
                    onValueChange={(v) => v && setMapping((m) => ({ ...m, [f.key]: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>매핑 안함</SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">매매 방향 (전체 적용)</label>
                <Select value={direction} onValueChange={(v) => v && setDirection(v as "long" | "short")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="long">매수(롱)</SelectItem>
                    <SelectItem value="short">공매도(숏)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {allMapped && rows.length > 0 ? (
              <div className="overflow-x-auto">
                <p className="mb-1 text-xs text-muted-foreground">미리보기 (앞 5행)</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {FIELDS.map((f) => <TableHead key={f.key}>{f.label}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 5).map((row, i) => {
                      const mapped = buildRow(row);
                      return (
                        <TableRow key={i}>
                          <TableCell>{mapped.ticker}</TableCell>
                          <TableCell>{mapped.entryDate}</TableCell>
                          <TableCell>{mapped.entryPrice}</TableCell>
                          <TableCell>{mapped.quantity}</TableCell>
                          <TableCell>{mapped.exitDate}</TableCell>
                          <TableCell>{mapped.exitPrice}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            <p className="text-xs text-muted-foreground">
              임포트된 거래는 사전 계획이 없으므로 프로세스 점수는 매기지 않고
              &ldquo;사전 계획 없음&rdquo; 태그가 자동으로 붙습니다.
            </p>

            <Button onClick={() => void handleImport()} disabled={!allMapped || importing}>
              {importing ? "임포트 중..." : `${rows.length}건 임포트`}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">결과</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{result.imported}건 임포트 완료.</p>
            {result.errors.length > 0 ? (
              <div className="text-amber-600">
                <p>{result.errors.length}건 건너뜀:</p>
                <ul className="list-inside list-disc">
                  {result.errors.slice(0, 10).map((e, i) => (
                    <li key={i}>행 {e.row + 1}: {e.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
