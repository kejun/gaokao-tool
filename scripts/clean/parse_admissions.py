#!/usr/bin/env python3
"""Parse Beijing 本科普通批录取投档线 2023/2024/2025 → data/processed/admissions_rows.json

Formats:
- 2023/2024: line-based MD, each row: 序号 院校代码 院校名称 专业组 选考要求 总分 语文 数学 外语 三科 [备注]
- 2025: space-token stream (jina PDF flatten); rows can LACK subject scores
  (北京大学: "38 1021 北京大学 01 不限 686 39 1021 ..."); notes like "外语线:105";
  PDF page headers injected mid-stream: "第 27 页，共 46 页北京教育考试院 2025年北京市高招...".

Strategy:
1. Strip PDF page-header/footer noise globally.
2. Collect ALL anchor candidates `seq(1-4d) + code(4d) + non-digit` with OVERLAPPING lookahead
   (so a false candidate like 三科"255" + seq"1000" never hides the true anchor "1000 4211").
3. Keep candidates with strictly increasing seq (kills "255 1000" style false anchors).
4. Parse each chunk bounded by consecutive kept anchors.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "processed"
OUT.mkdir(parents=True, exist_ok=True)

FILES = {2023: "toudang_2023.md", 2024: "toudang_2024.md", 2025: "toudang_2025.md"}
SUBJ_KEYS = ["yuwen", "shuxue", "waiyu", "sanke"]

# PDF page chrome: "第 27  页，共 46  页北京教育考试院 2025年北京市高招本科普通批录取投档线"
PAGE_CHROME = re.compile(
    r"第\s*\d+\s*页，共\s*\d+\s*页北京教育考试院\s*\d{4}年北京市高招本科普通批录取投档线\s*"
)
# column header rows: "序号 院校 专业组 总分 语文 数学 外语 三科 选考 其他 要求"
COLS = re.compile(r"序\s*号\s*院校\s*专业组\s*总分\s*语文\s*数学\s*外语\s*三科\s*选考\s*其他\s*要求\s*")

# overlapping anchor candidates: seq + code(4d) where code is followed by non-digit
ANCHOR = re.compile(r"(?=(?<!\d)(\d{1,4})\s+(\d{4})\s+(?=\S))")
INNER = re.compile(
    r"^(\S.*?)(\s+|\)|）)(\d{2})(?=\s+[^\d])\s+"
    r"([^\d]+?)\s*(\d{3})"
    r"(?:\s+(\d{2,3})\s+(\d{2,3})\s+(\d{2,3})\s+(\d{2,3}))?"
    r"(?:\s+(.*))?$"
)


def parse_year(year: int) -> list:
    text = (RAW / FILES[year]).read_text(encoding="utf-8", errors="replace")
    idx = text.find("Markdown Content")
    if idx != -1:
        text = text[idx + len("Markdown Content"):]
    text = PAGE_CHROME.sub(" ", text)
    text = COLS.sub(" ", text)

    cands = []
    for m in ANCHOR.finditer(text):
        seq, code = int(m.group(1)), m.group(2)
        cands.append((m.start() + m.group(1).index(str(seq)) if False else m.start(1), seq, code))
    # (lookahead: group span starts at seq; use m.start(1))

    kept = []
    last = 0
    for pos, seq, code in cands:
        if seq > last and code != str(seq):  # code must differ from seq (a "seq" isn't its own code)
            kept.append((pos, seq, code))
            last = seq

    rows = []
    for i, (pos, seq, code) in enumerate(kept):
        chunk_start = pos + len(str(seq)) + len(code) + 2  # skip "seq code " prefix
        chunk_end = kept[i + 1][0] if i + 1 < len(kept) else len(text)
        chunk = text[chunk_start:chunk_end].strip()
        chunk = chunk.replace("\n", " ")
        m = INNER.match(chunk)
        if not m:
            print(f"  [warn] {year} seq={seq} code={code} unparsed: {chunk[:100]!r}")
            continue
        name, sep, group, req = m.group(1), m.group(2), m.group(3), m.group(4)
        total = int(m.group(5))
        if sep in (")", "）"):  # sep 是右括号时回填到校名（如 华北电力大学(保定)01）
            name = name + sep
        if name[0].isdigit():
            print(f"  [warn] {year} seq={seq} bad name: {chunk[:100]!r}")
            continue
        subjects = {}
        for k, key in enumerate(SUBJ_KEYS):
            g = m.group(6 + k)
            if g:
                subjects[key] = int(g)
        rows.append({
            "year": year, "seq": seq, "school_code": code, "school_name": name,
            "group_code": group, "req_subjects": req, "total": total,
            "subjects": subjects, "note": (m.group(10) or "").strip(),
        })
    return rows


def main():
    all_rows = []
    for year in (2023, 2024, 2025):
        rows = parse_year(year)
        seqs = [r["seq"] for r in rows]
        gaps = [i for i in range(1, len(seqs)) if seqs[i] != seqs[i - 1] + 1][:5]
        no_subj = sum(1 for r in rows if len(r["subjects"]) != 4)
        # 序号须 1..N 连续
        print(f"{year}: {len(rows)} rows | missing seqs: {gaps} | rows without 4 subjects: {no_subj}"
              + (" ⚠️" if (seqs and seqs[-1] != len(seqs)) else " ✓"))
        all_rows.extend(rows)

    out = OUT / "admissions_rows.json"
    out.write_text(json.dumps({"format": "beijing_benke_putongpi_toudang", "years": [2023, 2024, 2025],
                               "rows": all_rows}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {out} ({len(all_rows)} rows, {out.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()