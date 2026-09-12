/**
 * 数据层 — 分层加载 + IndexedDB 缓存（强化离线可用）
 * L1: score_rank / admissions_school / schools （首屏 import）
 * L2: 选科要求分片（按省份懒加载，进院校详情时按需）
 */
import Dexie from 'dexie'
import { parseRequire } from './core'

const db = new Dexie('gaokao-cache')
db.version(1).stores({
  json: 'key',
})

const memoryCache = new Map()

async function loadWithCache(key, url) {
  if (memoryCache.has(key)) return memoryCache.get(key)
  try {
    const cached = await db.json.get(key)
    if (cached) {
      memoryCache.set(key, cached.value)
      return cached.value
    }
  } catch (e) { /* dexie unavailable */ }
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`加载失败: ${url}`)
  const data = await resp.json()
  memoryCache.set(key, data)
  try { await db.json.put({ key, value: data }) } catch (e) { /* ignore */ }
  return data
}

let l1 = null
/** 加载 L1 核心数据（首屏） */
export async function loadL1() {
  if (l1) return l1
  const base = import.meta.env.BASE_URL + 'data/'
  const [scoreRank, admissions, schools, websites] = await Promise.all([
    loadWithCache('score_rank', base + 'score_rank.json'),
    loadWithCache('admissions_school', base + 'admissions_school.json'),
    loadWithCache('schools', base + 'schools.json'),
    loadWithCache('school_websites', base + 'school_websites.json'),
  ])
  l1 = { scoreRank, admissions, schools, websites }
  return l1
}

const subjCache = new Map()
/** L2：按省份加载选科要求分片 */
export async function loadSubjectProvince(province) {
  if (subjCache.has(province)) return subjCache.get(province)
  const base = import.meta.env.BASE_URL + 'data/subj/'
  const data = await loadWithCache('subj_' + province, base + encodeURIComponent(province) + '.json')
  subjCache.set(province, data)
  return data
}

/** L2 聚合：某省招生目录的专业+选科要求列表（P0 核心，决定能否报考） */
export async function loadL2(province = '北京') {
  const rows = await loadSubjectProvince(province)
  const majors = rows.map(([code, name, mcode, major, require]) => ({
    school_id: String(code),
    school_name: name,
    major_code: String(mcode),
    major,
    require_subjects: parseRequire(require),
    plan_count: null,
  }))
  return { majors, province }
}

let subj2027 = null
/** 2027 选科要求变化标注（F11.1）：返回 { `${school_id}:${major_code}`: {note, is_relaxed} } */
export async function loadSubject2027() {
  if (subj2027) return subj2027
  const base = import.meta.env.BASE_URL + 'data/'
  const data = await loadWithCache('subject_2027', base + 'subject_2027.json')
  const idx = {}
  for (const r of data) {
    idx[`${r.school_id}:${r.major_code}`] = { note: r.note, is_relaxed: r.is_relaxed }
  }
  subj2027 = idx
  return idx
}

/** 构建按院校 code 索引的选科要求（供院校详情页使用） */
const subjIdxCache = new Map()
export async function buildSchoolSubjectIndex(province) {
  if (subjIdxCache.has(province)) return subjIdxCache.get(province)
  const rows = await loadSubjectProvince(province)
  const idx = new Map()
  for (const [code, name, mcode, major, req] of rows) {
    if (!idx.has(code)) idx.set(code, [])
    idx.get(code).push({ school_code: code, school_name: name, major_code: mcode, major, require: parseRequire(req) })
  }
  subjIdxCache.set(province, idx)
  return idx
}

/** 构建分数→row 的索引，按年份 */
export function buildScoreIndex(scoreRank) {
  const idx = {}
  for (const r of scoreRank) {
    if (!idx[r.year]) idx[r.year] = new Map()
    idx[r.year].set(r.score, r)
  }
  return idx
}

/** 查找某分数在某年的位次 row；分数不在表内取相邻低分估算 */
export function lookupScore(scoreIdx, year, score) {
  const m = scoreIdx[year]
  if (!m) return null
  if (m.has(score)) return m.get(score)
  let best = null
  for (const [k, v] of m) {
    if (k <= score && (!best || k > best.score)) best = { score: k, row: v }
  }
  return best ? best.row : null
}