import { describe, it, expect } from 'vitest'
import {
  parseRequire, isEligible, scoreToRank, equivalentScore,
  classify, schoolRankRange, checkGradient, adjustRisk,
} from '../src/lib/core.js'

/* ── F3.2 选科硬过滤（验收 #3 最高优先级）── */
describe('parseRequire 选科要求解析', () => {
  it('不限选科 → 空集', () => {
    expect(parseRequire('不提科目要求')).toEqual([])
    expect(parseRequire('')).toEqual([])
    expect(parseRequire(null)).toEqual([])
  })
  it('物化双选（含招生目录长尾文案）→ [物理,化学]', () => {
    expect(parseRequire('物理,化学(2门科目考生均须选考方可报考)')).toEqual(['物理', '化学'])
    expect(parseRequire('物理+化学')).toEqual(['物理', '化学'])
    expect(parseRequire('物理和化学')).toEqual(['物理', '化学'])
    expect(parseRequire('物理／化学')).toEqual(['物理', '化学'])
  })
  it('单科要求 政治 → [政治]', () => {
    expect(parseRequire('思想政治')).toEqual(['思想政治'])
  })
  it('数组输入原样清洗', () => {
    expect(parseRequire(['物理', '化学'])).toEqual(['物理', '化学'])
  })
})

describe('isEligible 选科硬过滤（物化历 = [物理,化学,历史]）', () => {
  const sel = ['物理', '化学', '历史']
  it('临床医学（必选物化）→ ✅ 可报', () => {
    expect(isEligible('物理,化学(2门科目考生均须选考方可报考)', sel)).toBe(true)
  })
  it('政治学类（必选政治）→ ❌ 不可报', () => {
    expect(isEligible('思想政治', sel)).toBe(false)
  })
  it('不限选科 → ✅ 可报', () => {
    expect(isEligible('不提科目要求', sel)).toBe(true)
  })
  it('只要物理 → ✅ 可报', () => {
    expect(isEligible('物理', sel)).toBe(true)
  })
  it('只要生物 → ❌ 不可报（物化历无生物）', () => {
    expect(isEligible('生物', sel)).toBe(false)
  })
  it('物或化（任一）→ ✅ 可报', () => {
    expect(isEligible(['物理', '化学'], sel)).toBe(true)
  })
})

/* ── F1.4 位次换算边界 ── */
describe('scoreToRank 位次区间', () => {
  it('边界分数取 [cum-count+1, cum] 区间而非单点', () => {
    expect(scoreToRank({ score: 560, count: 312, cum: 18420 })).toEqual([18109, 18420])
  })
  it('同分人数为 1 → 单点区间', () => {
    expect(scoreToRank({ score: 561, count: 1, cum: 18500 })).toEqual([18500, 18500])
  })
  it('空数据 → null', () => {
    expect(scoreToRank(null)).toBeNull()
    expect(scoreToRank(undefined)).toBeNull()
  })
})

/* ── F1.2 等效分 ── */
describe('equivalentScore 同位次跨年等效分', () => {
  const tableB = new Map([
    [580, { score: 580, count: 100, cum: 12000 }],
    [570, { score: 570, count: 200, cum: 15000 }],
    [560, { score: 560, count: 300, cum: 18000 }],
    [550, { score: 550, count: 400, cum: 21000 }],
  ])
  it('A 年位次 18109（560 段低位）→ B 年落在 550 分段', () => {
    // 560 段 cum=18000 < 18109，说明 B 年 560 只到 18000 名；18109 名在 550 段（cum 21000 ≥ 18109）
    expect(equivalentScore(18109, tableB)).toBe(550)
  })
  it('较高位次 11900 → B 年 580 分段（cum 12000 ≥ 11900）', () => {
    expect(equivalentScore(11900, tableB)).toBe(580)
  })
  it('位次超出全表范围 → null', () => {
    expect(equivalentScore(999999, tableB)).toBeNull()
  })
})

/* ── F2.2 冲稳保分级（基于位次差）── */
describe('classify 冲稳保分级', () => {
  // 位次数值越小越优；本校区间 [12000, 18000]
  it('我位次优于该校最好位次（11000 < 12000）→ 冲', () => {
    expect(classify(11000, 12000, 18000)).toBe('chong')
  })
  it('我位次落在区间内 → 稳', () => {
    expect(classify(15000, 12000, 18000)).toBe('wen')
    expect(classify(15000, 15000, 18000)).toBe('wen') // 边界等于 bestRank 也算稳（分数够）
  })
  it('我位次劣于该校最差位次 → 保', () => {
    expect(classify(19000, 12000, 18000)).toBe('bao')
  })
  it('数据缺失 → 降级为稳（不误判）', () => {
    expect(classify(15000, null, null)).toBe('wen')
  })
})

describe('schoolRankRange 聚合近三年位次', () => {
  const years = {
    2023: { min_rank_lo: 10000, min_rank_hi: 10500 },
    2024: { min_rank_lo: 13000, min_rank_hi: 13500 },
    2025: { min_rank_lo: 12000, min_rank_hi: 12500 },
  }
  it('聚合 best/worst', () => {
    expect(schoolRankRange(years)).toEqual({ best: 10000, worst: 13500 })
  })
  it('无有效年份 → null', () => {
    expect(schoolRankRange({})).toBeNull()
    expect(schoolRankRange(null)).toBeNull()
  })
})

/* ── F8.5 梯度检测 ── */
describe('checkGradient 志愿表梯度倒挂检测', () => {
  it('合理梯度（位次递减/前难后易）→ 无倒挂', () => {
    // 按位次排序：前列位次小（难），后列位次大（易）
    const items = [
      { name: '冲1', rank: 12000 },
      { name: '稳1', rank: 15000 },
      { name: '保1', rank: 19000 },
    ]
    expect(checkGradient(items)).toEqual([])
  })
  it('倒挂（后志愿比前志愿更难）→ 报出', () => {
    const items = [
      { name: '冲1', rank: 15000 },
      { name: '保1', rank: 12000 }, // 位次更小=更难，倒挂！
    ]
    const problems = checkGradient(items)
    expect(problems).toHaveLength(1)
    expect(problems[0].index).toBe(2) // 第 2 个志愿
  })
  it('含未知位次项不误报', () => {
    const items = [
      { name: 'A', rank: 15000 },
      { name: 'B', rank: null },
      { name: 'C', rank: 18000 },
    ]
    expect(checkGradient(items)).toEqual([])
  })
})

/* ── F8.3 调剂风险三级判定 ── */
describe('adjustRisk 调剂风险', () => {
  // 组投档线位次 16000；位次越小越优
  it('未过线（18000 > 16000）→ mid：无调剂但志愿落空风险', () => {
    expect(adjustRisk(18000, 16000, false)).toBe('mid')
  })
  it('贴线进档（缓冲 1000 名 < 3000）→ high：热门专业录满被调剂概率高', () => {
    expect(adjustRisk(15000, 16000, false)).toBe('high')
  })
  it('高出投档线 4000 名但组内有不可接受专业 → mid', () => {
    expect(adjustRisk(12000, 16000, true)).toBe('mid')
  })
  it('高出投档线 4000 名且无不可接受专业 → low', () => {
    expect(adjustRisk(12000, 16000, false)).toBe('low')
  })
  it('缺数据 → mid（谨慎默认）', () => {
    expect(adjustRisk(null, 16000, false)).toBe('mid')
    expect(adjustRisk(15000, null, false)).toBe('mid')
  })
})