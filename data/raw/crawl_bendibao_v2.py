#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json, re, time, os
import urllib.request, ssl
ctx = ssl.create_default_context(); ctx.check_hostname=False; ctx.verify_mode=ssl.CERT_NONE
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
BASE = "http://bj.bendibao.com/edu/toudangfenshuxian/school.php?id={}&qid=%E5%8C%97%E4%BA%AC&year=2026"
OUT = "/root/gaokao-tool/data/processed/admissions_2026_bendibao.json"
schools = json.load(open("/root/gaokao-tool/data/raw/bendibao_schools_2026.json"))
done = set()
if os.path.exists(OUT):
    for r in json.load(open(OUT)): done.add(r["school_id"])
results = [r for r in (json.load(open(OUT)) if os.path.exists(OUT) else [])]
def get(url):
    for i in range(2):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language":"zh-CN,zh;q=0.9"})
            with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
                return r.read().decode("utf-8","ignore")
        except Exception:
            time.sleep(5)
    return None
def parse(html):
    out = []
    for b in re.split(r'类别：', html)[1:]:
        cat = re.search(r'类别：([^<\n]+)', b); score = re.search(r'投档线[^<\d]*(\d{3})', b)
        if not cat or not score: continue
        gname = re.search(r'专业组名称：([^<\n]+)', b); gid = re.search(r'专业组编号：([^<\n]+)', b)
        out.append({"batch":cat.group(1).strip(),"group_name":(gname.group(1) if gname else "").strip(),
                    "group_code":(gid.group(1) if gid else "").strip(),"min_score":int(score.group(1))})
    return out
t0=time.time(); ok=0
for i,(sid,name) in enumerate(schools):
    if sid in done: continue
    html = get(BASE.format(sid))
    if html:
        parsed = parse(html)
        if parsed: results.append({"school_id":sid,"name":name,"groups":parsed}); ok+=1
    done.add(sid)
    if len(done) % 40 == 0:
        json.dump(results, open(OUT,"w"), ensure_ascii=False)
        open("/root/gaokao-tool/data/raw/crawl2_progress.log","a").write(f"{len(done)}/{len(schools)} ok={len(results)} {time.time()-t0:.0f}s\n")
    time.sleep(8)   # 合规低频
json.dump(results, open(OUT,"w"), ensure_ascii=False)
open("/root/gaokao-tool/data/raw/crawl2_progress.log","a").write(f"DONE {len(results)}/{len(schools)} {time.time()-t0:.0f}s\n")
