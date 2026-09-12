/**
 * 核心算法库 — 纯函数，可单测
 * F1 位次换算 / F1.2 等效分 / F2 冲稳保分级 / F3 选科硬过滤 / 志愿表梯度检测
 */

/** 解析选科要求字符串 → 科目集合。例："物理,化学(2门科目考生均须选考方可报考)" → ['物理','化学']；兼容数组输入 */
export function parseRequire(req) {
  if (!req) return []
  if (Array.isArray(req)) return req.map(s => String(s).trim()).filter(Boolean)
  if (req === '不提科目要求') return []
  const m = String(req).match(/^([^（(]+)/)
  if (!m) return []
  return m[1].split(/[,，/、＋+和／]/).map(s => s.trim()).filter(Boolean)
}

/** 选科硬过滤：专业选科要求 ⊆ 用户已选科目（不限=空集 ⊆ 任意 → True） */
export function isEligible(reqSubjects, selected) {
  const req = parseRequire(reqSubjects || '')
  if (req.length === 0) return true
  const sel = new Set(selected)
  return req.every(s => sel.has(s))
}

/**
 * 位次换算：分数 → 位次区间 [lo, hi]
 * row: {score, count, cum}；边界分数取 [cum-count+1, cum]
 */
export function scoreToRank(row) {
  if (!row) return null
  return [row.cum - row.count + 1, row.cum]
}

/** 等效分：根据年份 A 的位次区间上界(保守)在年份 B 一分一段表反查分数 */
export function equivalentScore(rankHi, tableB) {
  // tableB: Map score->row；从高分向下找第一个 cum >= rankHi 的分段 → 该位次在 B 年所在分数段
  const rows = [...tableB].sort((a, b) => b[0] - a[0])
  for (const [score, row] of rows) {
    if (row.cum >= rankHi) return score
  }
  return null
}

/**
 * 冲稳保分级（基于位次，需求 §F2.2）
 * myRank: 本人位次（越大越差）
 * school: {bestRank, worstRank} 院校近三年最优/最差位次(数值=位次,越小越好)
 * 返回 'chong' | 'wen' | 'bao'
 */
export function classify(myRank, bestRank, worstRank) {
  if (myRank == null || bestRank == null) return 'wen'
  if (myRank < bestRank) return 'chong'   // 我位次比该校最好还靠前 → 冲
  if (myRank <= worstRank) return 'wen'   // 落在区间内
  return 'bao'                            // 我位次更差 → 保
}

/** 从院校年数据聚合 best/worst 位次（min_rank_lo 越小越好） */
export function schoolRankRange(years) {
  let best = Infinity, worst = -Infinity
  for (const y of Object.values(years || {})) {
    if (y.min_rank_lo < best) best = y.min_rank_lo
    if (y.min_rank_hi > worst) worst = y.min_rank_hi
  }
  if (best === Infinity) return null
  return { best, worst }
}

/** 志愿表梯度检测：按位次排序，检测倒挂（前面志愿位次要求高于后面） */
export function checkGradient(items) {
  // items: [{rank: number}] 已按志愿顺序
  const problems = []
  for (let i = 0; i < items.length - 1; i++) {
    // 位次数值越小越难；倒挂 = 前一个位次要求(小) 反而在 后一个(大) 之后 — 即前易后难
    const a = items[i], b = items[i + 1]
    if (a.rank !== null && b.rank !== null && a.rank > b.rank) {
      problems.push({ index: i + 2, a, b }) // 第 i+2 个志愿更冲
    }
  }
  return problems
}

/** 调剂风险：本人位次 vs 该组投档线位次 + 组内是否有不可接受专业。返回 'high'|'mid'|'low' */
export function adjustRisk(myRank, groupRank, hasBadMajor) {
  if (groupRank == null || myRank == null) return 'mid'
  const buffer = groupRank - myRank // >0 = 我位次优于投档线（过线）
  if (buffer <= 0) return 'mid'      // 未过线/压线：无调剂可言，但志愿落空风险，非安全 → mid
  if (buffer < 3000) return 'high'   // 贴线进档（≈8-10分内）→ 热门专业录满，被调剂概率高
  if (hasBadMajor) return 'mid'
  return 'low'
}