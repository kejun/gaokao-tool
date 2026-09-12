#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json, re, time, os, sys
import urllib.request, ssl

ctx = ssl.create_default_context(); ctx.check_hostname=False; ctx.verify_mode=ssl.CERT_NONE
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
BASE = "http://bj.bendibao.com/edu/toudangfenshuxian/school.php?id={}&qid=%E5%8C%97%E4%BA%AC&year=2026"

def get(url, tries=2):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9"})
            with urllib.request.urlopen(req, timeout=20, context=ctx) as r:
                return r.read().decode("utf-8", "ignore")
        except Exception as e:
            if i == tries-1: return None
            time.sleep(4)
    return None

def parse_school(html):
    if not html: return None
    out = []
    blocks = re.split(r'类别：', html)
    for b in blocks[1:]:
        cat = re.search(r'类别：([^<\n]+)', b)
        gname = re.search(r'专业组名称：([^<\n]+)', b)
        gid = re.search(r'专业组编号：([^<\n]+)', b)
        score = re.search(r'投档线\s*</[^>]+>\s*<[^>]+>\s*(\d+)', b) or re.search(r'投档线[^<\d]*(\d{3})', b)
        yushu = re.search(r'语数之和[^<\d]*(\d+)', b)
        yushu_max = re.search(r'语数最高[^<\d]*(\d+)', b)
        waiyu = re.search(r'外语[^<\d]*(\d+)', b)
        code = re.search(r'院校代码[^<\d]*(\d+)', b)
        beizhu = re.search(r'备注[^<]*<[^>]*>([^<]+)', b)
        if not cat or not score:
            continue
        out.append({
            "batch": (cat.group(1) if cat else "").strip(),
            "group_name": (gname.group(1) if gname else "").strip(),
            "group_code": (gid.group(1) if gid else "").strip(),
            "min_score": int(score.group(1)) if score else None,
            "ys_sum": int(yushu.group(1)) if yushu else None,
            "ys_max": int(yushu_max.group(1)) if yushu_max else None,
            "foreign": int(waiyu.group(1)) if waiyu else None,
            "school_code": (code.group(1) if code else "").strip(),
            "note": (beizhu.group(1) if beizhu else "").strip(),
        })
    return out if out else None

schools = json.load(open("/root/gaokao-tool/data/raw/bendibao_schools_2026.json"))
results = []
log = open("/root/gaokao-tool/data/raw/crawl_2026_progress.log", "w")
t0 = time.time()
for i, (sid, name) in enumerate(schools):
    html = get(BASE.format(sid))
    if html is None:
        log.write(f"FAIL {sid} {name}\n"); log.flush()
        continue
    parsed = parse_school(html)
    if parsed:
        results.append({"school_id": sid, "name": name, "groups": parsed})
    if (i+1) % 100 == 0:
        log.write(f"progress {i+1}/{len(schools)} ok={len(results)} {time.time()-t0:.0f}s\n"); log.flush()
    time.sleep(2.5)   # 合规低频
json.dump(results, open("/root/gaokao-tool/data/processed/admissions_2026_bendibao.json", "w"), ensure_ascii=False)
log.write(f"DONE {len(results)}/{len(schools)} {time.time()-t0:.0f}s\n"); log.close()
print("done", len(results))
