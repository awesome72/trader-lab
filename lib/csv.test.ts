import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";

describe("parseCsv", () => {
  it("parses a simple comma-separated file with a header row", () => {
    const result = parseCsv("a,b,c\n1,2,3\n4,5,6");
    expect(result.headers).toEqual(["a", "b", "c"]);
    expect(result.rows).toEqual([
      ["1", "2", "3"],
      ["4", "5", "6"],
    ]);
  });

  it("handles quoted fields containing commas", () => {
    const result = parseCsv('name,note\n"삼성전자","돌파, 거래량 급증"\n');
    expect(result.rows).toEqual([["삼성전자", "돌파, 거래량 급증"]]);
  });

  it("handles escaped double quotes inside a quoted field", () => {
    const result = parseCsv('a,b\n"he said ""hi""",2\n');
    expect(result.rows).toEqual([['he said "hi"', "2"]]);
  });

  it("handles a newline embedded inside a quoted field", () => {
    const result = parseCsv('a,b\n"line1\nline2",x\n');
    expect(result.rows).toEqual([["line1\nline2", "x"]]);
  });

  it("handles CRLF line endings", () => {
    const result = parseCsv("a,b\r\n1,2\r\n3,4\r\n");
    expect(result.rows).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("ignores a trailing blank line", () => {
    const result = parseCsv("a,b\n1,2\n\n");
    expect(result.rows).toEqual([["1", "2"]]);
  });

  it("returns empty headers/rows for an empty string", () => {
    const result = parseCsv("");
    expect(result.headers).toEqual([]);
    expect(result.rows).toEqual([]);
  });

  it("returns just headers when there are no data rows", () => {
    const result = parseCsv("a,b,c");
    expect(result.headers).toEqual(["a", "b", "c"]);
    expect(result.rows).toEqual([]);
  });
});
