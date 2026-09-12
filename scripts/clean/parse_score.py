#!/usr/bin/env python3
"""Parse 北京 一分一段表 (score distribution) from raw jina markdown → JSON.
Inputs: data/raw/score_2023.md (HTML), score_2024.md (HTML), score_2025.md (PDF markdown)
Output: data/processed/score_rank.json
Fields: year, score, count, cum, band(bool)
"""
import re, json, sys
from pathlib import Path

RAW = Path(__file__).resolve().parents[2] / "data/raw"
OUT = Path(__file__).resolve().parents[2] / "data/processed"
OUT.mkdir(exist_ok=True)

def parse_year(text: str, year: int) -> list:
    rows = []
    # patterns: "696分以上 104 104" | "695 11 115" | bands "380—389 120 5000" or "380-389 ..."
    pat_top = re.compile(r"^\s*(\d{3})分以上\s+(\d+)\s+(\d+)")
    pat_row = re.compile(r"^\s*(\d{3})\s+(\d+)\s+(\d+)\s*$")
    pat_band = re.compile(r"^\s*(\d{3})\s*[—\-~至]\s*(\d{3})\s+(\d+)\s+(\d+)")
    for line in text.splitlines():
        line = line.strip()
        m = pat_top.match(line)
        if m:
            rows.append({"year": year, "score": int(m.group(1)), "count": int(m.group(2)),
                         "cum": int(m.group(3)), "band": False, "top": True})
            continue
        m = pat_band.match(line)
        if m:
            rows.append({"year": year, "score": int(m.group(2)), "score_lo": int(m.group(1)),
                         "count": int(m.group(3)), "cum": int(m.group(4)), "band": True})
            continue
        m = pat_row.match(line)
        if m:
            rows.append({"year": year, "score": int(m.group(1)), "count": int(m.group(2)),
                         "cum": int(m.group(3)), "band": False})
    return rows

def parse_pdf_triplets(text: str, year: int) -> list:
    """2025 PDF: inline '660 94 2153 659 93 2246 ...' with '698分以上 104 104' at top, bands at bottom."""
    rows = []
    # top: "698分以上 104 104"
    m_top = re.search(r"(\d{3})分以上\s*(\d+)\s*(\d+)", text)
    if m_top:
        rows.append({"year": year, "score": int(m_top.group(1)), "count": int(m_top.group(2)),
                     "cum": int(m_top.group(3)), "band": False, "top": True})
    # triplets: score count cum  (score 3-digit; count ≤ 2000; cum ≥ count, ≤ 60000)
    pat = re.compile(r"\b(\d{3})\s+(\d{1,4})\s+(\d{1,7})\b")
    seen = {r["score"] for r in rows}
    for m in pat.finditer(text):
        s, c, cu = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if s in seen:
            continue
        if 380 <= s <= 700 and 0 < c <= 3000 and cu >= c and cu <= 70000:
            seen.add(s)
            rows.append({"year": year, "score": s, "count": c, "cum": cu, "band": False})
    return rows

def main():
    out = []
    for year, fn, kind in [(2023, "score_2023.md", "md"), (2024, "score_2024.md", "md"), (2025, "score_2025.md", "pdf")]:
        text = (RAW / fn).read_text(encoding="utf-8", errors="ignore")
        rows = parse_year(text, year) if kind == "md" else parse_pdf_triplets(text, year)
        rows.sort(key=lambda r: r["score"], reverse=True)
        out.extend(rows)
        print(f"{year}: {len(rows)} rows | first={rows[0] if rows else None} | last={rows[-1] if rows else None}")
    (OUT / "score_rank.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Wrote {OUT/'score_rank.json'} total {len(out)} rows")

if __name__ == "__main__":
    main()