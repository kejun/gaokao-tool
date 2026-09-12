#!/usr/bin/env python3
"""Data validation + manifest generation for gaokao-tool.
Checks: schema fields, score sanity, duplicates, coverage, then writes data-manifest.json."""
import json, datetime, os, sys

BASE = '/root/gaokao-tool/data/processed/'
OUT = '/root/gaokao-tool/data/processed/data-manifest.json'

def load(fn):
    with open(BASE + fn, encoding='utf-8') as f:
        return json.load(f)

report = {}
issues = []

# --- score_rank ---
sr = load('score_rank.json')
years = {}
for r in sr:
    years.setdefault(r['year'], []).append(r)
    if not (380 <= r['score'] <= 750): issues.append(f'score out of range: {r}')
    if r['cum'] < r['count']: issues.append(f'cum<count: {r}')
report['score_rank'] = {'rows': len(sr), 'years': {y: len(v) for y, v in years.items()}}

# --- admissions_school ---
adm = load('admissions_school.json')
with_scores = 0
for s in adm:
    for y, v in s['years'].items():
        if not (400 <= v['min_score'] <= 750): issues.append(f'adm score bad {s["name"]} {y}: {v["min_score"]}')
        if not (1 <= v['min_rank_lo'] <= v['min_rank_hi'] <= 60000): issues.append(f'adm rank bad {s["name"]} {y}')
    if s['years']: with_scores += 1
report['admissions_school'] = {'schools': len(adm), 'with_data': with_scores,
    'pct_with_data': round(100*with_scores/max(len(adm),1), 1)}

# --- subject_requirements_2027 ---
subj = load('subject_requirements_2027.json')
schools = set(); req_counts = {}
for r in subj:
    schools.add(r['school_code'])
    req_counts[r['require']] = req_counts.get(r['require'], 0) + 1
    if r['school_code'] not in r.get('province', '') and len(r['school_code']) != 5:
        issues.append(f'bad school_code {r}')
report['subject_requirements_2027'] = {'records': len(subj), 'schools': len(schools)}

# --- schools ---
sc = load('schools.json')
t_count = sum(1 for s in sc if s['tier'])
report['schools'] = {'total': len(sc), 'with_tier': t_count}

# dedupe checks
dup1 = len(sr) - len({(r['year'], r['score']) for r in sr})
dup2 = len(subj) - len({(r['school_code'], r['major_code'], r['major'], r['require']) for r in subj})
if dup1: issues.append(f'score_rank dupes: {dup1}')
if dup2: issues.append(f'subject dupes: {dup2}')
report['dupes'] = {'score_rank': dup1, 'subject': dup2}

manifest = {
    'generated_at': datetime.date.today().isoformat(),
    'version': '0.1.0',
    'disclaimer': '数据来源于各省教育考试院、阳光高考平台及各高校招生网公开信息，仅供志愿填报辅助参考，非商用。最终以官方公布为准。',
    'coverage': report,
    'sources': {
        'score_rank': '北京教育考试院一分一段表 2023-2025 物理类',
        'admissions_school': '北京教育考试院本科普通批投档线 2023-2025',
        'subject_requirements_2027': '教育部/考试院 2027通用版选考科目要求(适用2027+) sdzk.cn',
        'schools': '2027选科要求文件院校清单 + 院校层次标签(公开名录)',
    },
    'issues': issues[:50],
}
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)
print('OK issues=%d coverage=%s' % (len(issues), json.dumps(report, ensure_ascii=False)))