#!/usr/bin/env python3
"""Parse 2027 通用版选科要求 (sdzk.cn 644-page PDF markdown) -> JSON.
Format lost newlines: continuous text like
  10001 北京大学 0015 文科试验班类 不提科目要求 北京 10001 北京大学 ...
Strategy: split by 5-digit school code, then per school block extract records
via pro-code pattern + known requirement phrase + trailing province.
"""
import re, json, sys

p_raw = '/root/gaokao-tool/data/raw/sd_2027_req.md'
p_out = '/root/gaokao-tool/data/processed/subject_requirements_2027.json'

with open(p_raw, encoding='utf-8') as f:
    txt = f.read()
# drop jina header (before '# 2027通用版' first occurrence) and page header noise
idx = txt.find('2027通用版')
txt = txt[idx:]
# strip the repeated header lines
txt = re.sub(r'# （适用于2027年及以后参加高考的考生）\s*', '', txt)
txt = re.sub(r'院校 代码 院校名称 专业 代码 专业（类） 选考科目要求 院校所 在省份\s*', '', txt)
txt = re.sub(r'院校 代码 院校名称 专业 代码 专业（类） 选考科目要求 院校所在省份\s*', '', txt)
# collapse whitespace to single spaces
txt = re.sub(r'\s+', ' ', txt)

# Province list to anchor record end
PROVINCES = '|'.join(['北京','天津','河北','山西','内蒙古','辽宁','吉林','黑龙江','上海','江苏','浙江','安徽','福建','江西','山东','河南','湖北','湖南','广东','广西','海南','重庆','四川','贵州','云南','西藏','陕西','甘肃','青海','宁夏','新疆'])
# Requirement phrase variants (everything between pro name and province)
REQ_RE = r'(不提科目要求|思想政治(?:\([^)]*\))?|物理(?:,化学)?(?:,生物)?(?:,地理)?(?:,思想政治)?(?:\([^)]*\))?|化学(?:,生物)?(?:,地理)?(?:\([^)]*\))?|生物(?:,地理)?(?:\([^)]*\))?|历史(?:\([^)]*\))?|地理(?:\([^)]*\))?)'

SCODE = r'(\d{5})\s+([\u4e00-\u9fff]{2,40}?)\s+([A-Za-z]?\d{2,6}[A-Za-z]?)\s+([\u4e00-\u9fff()（）·、,，\-A-Za-z0-9]+?)\s+' + REQ_RE + r'\s+(' + PROVINCES + r')(?=\s+\d{5}\s|$)'

pat = re.compile(SCODE)
records = []
for m in pat.finditer(txt):
    code, name, pcode, major, req, prov = m.groups()
    # skip non-本科? file is 本科 table already; skip lines where major looks like header
    if major in ('院校名称', '专业（类）', '选考科目要求'):
        continue
    records.append({
        'school_code': code, 'school_name': name, 'major_code': pcode,
        'major': major, 'require': req, 'province': prov,
        'source': 'sdzk.cn 2027通用版选科要求(适用2027+)', 'crawl_date': '2026-09-12'
    })

print('records:', len(records))
# dedupe by (code,major_code,major,req)
seen = set(); uniq = []
for r in records:
    k = (r['school_code'], r['major_code'], r['major'], r['require'])
    if k not in seen:
        seen.add(k); uniq.append(r)
print('unique:', len(uniq))
# stats
from collections import Counter
sc = Counter(r['school_code'] for r in uniq)
print('schools:', len(sc))
rc = Counter(r['require'] for r in uniq)
for k, v in rc.most_common(15):
    print(f'  req[{k}] = {v}')
# probe common majors for 2027 relaxed check
probe = {'中医学','护理学','汉语言文学','临床医学','政治学','计算机科学与技术','法学'}
for maj in probe:
    hits = [r for r in uniq if r['major'] == maj]
    if hits:
        print(f'\n{maj}: {len(hits)} records, examples:', [(h['school_name'], h['require']) for h in hits[:4]])

json.dump(uniq, open(p_out, 'w'), ensure_ascii=False, indent=1)
print('\nwrote', p_out)