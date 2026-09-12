import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { loadL1, buildScoreIndex, lookupScore } from '../lib/data'
import { scoreToRank, equivalentScore } from '../lib/core'

export const useScoreStore = defineStore('score', () => {
  const score = ref(560)
  const subjects = ref(['物理', '化学', '历史'])  // 默认物化历
  const loaded = ref(false)
  let scoreIdx = null
  let scoreRank = null

  async function ensure() {
    if (loaded.value) return
    const l1 = await loadL1()
    scoreRank = l1.scoreRank
    scoreIdx = buildScoreIndex(scoreRank)
    loaded.value = true
  }

  /** 某年位次区间 [lo, hi] */
  function rankFor(year) {
    if (!scoreIdx) return null
    const row = lookupScore(scoreIdx, year, score.value)
    return scoreToRank(row)
  }

  const years = [2023, 2024, 2025]
  const rankInfo = computed(() => {
    if (!loaded.value) return { rows: [], avgRank: null, oneYear: null }
    const rows = years.map(y => {
      const [lo, hi] = rankFor(y) || [null, null]
      return { year: y, lo, hi }
    })
    const valid = rows.filter(r => r.lo != null)
    const avgRank = valid.length ? Math.round(valid.reduce((s, r) => s + (r.lo + r.hi) / 2, 0) / valid.length) : null
    return { rows, avgRank, oneYear: valid[0] || null }
  })

  /** 等效分：用当年位次上界在目标年份反查 */
  function equivScore(fromYear, toYear) {
    if (!scoreIdx || !scoreIdx[fromYear] || !scoreIdx[toYear]) return null
    const row = lookupScore(scoreIdx, fromYear, score.value)
    if (!row) return null
    return equivalentScore(row.cum, scoreIdx[toYear])
  }

  /** F2 检索：返回 {冲[], 稳[], 保[]} */
  function searchSchools() {
    const l1 = loadL1()
    if (!l1) return { chong: [], wen: [], bao: [] }
    // 用三年平均位次作为本人位次
    const avg = rankInfo.value.avgRank
    if (avg == null) return { chong: [], wen: [], bao: [] }
    const result = { chong: [], wen: [], bao: [] }
    // searchSchools 需读取 admissions，这里改为返回纯函数逻辑由页面调用
    return { _avg: avg }
  }

  return { score, subjects, loaded, ensure, rankInfo, equivScore, rankFor, searchSchools, years }
})