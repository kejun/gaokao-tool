<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useScoreStore } from '../stores/score'
import { useFavoriteStore } from '../stores/favorites'
import { loadL1 } from '../lib/data'
import { classify, schoolRankRange } from '../lib/core'
import * as echarts from 'echarts'

const store = useScoreStore()
const fav = useFavoriteStore()
const loading = ref(true)
const schools = ref([])
const admissions = ref([])

const rows = ref([]) // {id, school_id, name, group_code, label, adjust: bool, majors: [6 of string], rank}

onMounted(async () => {
  await store.ensure()
  const l1 = await loadL1()
  schools.value = l1.schools
  admissions.value = l1.admissions
  loading.value = false
  // 初始从收藏生成候选行
  buildFromFav()
  setTimeout(renderWaterfall, 100)
})

watch(rows, () => setTimeout(renderWaterfall, 100), { deep: true })

function schoolOf(id) { return schools.value.find(s => s.school_id === id) }
function admOf(id) { return admissions.value.find(a => a.school_id === id) }
function rankOf(schoolId, groupCode) {
  const a = admOf(schoolId)
  if (!a?.years) return null
  const rng = schoolRankRange(a.years)
  return rng ? rng.worst : null
}

function buildFromFav() {
  // 按收藏分组：同一校同组 1 行；组名取第一专业
  const seen = new Map()
  for (const it of fav.items) {
    const key = `${it.school_id}|${it.group_code || ''}`
    if (!seen.has(key)) {
      seen.set(key, { id: key, school_id: it.school_id, group_code: it.group_code || '', majors: [] })
    }
    const row = seen.get(key)
    if (it.major && row.majors.length < 6) row.majors.push(it.major)
  }
  rows.value = [...seen.values()].map(r => {
    const s = schoolOf(r.school_id)
    return { ...r, name: s?.name || r.school_id, label: labelOf(r.school_id), adjust: true, rank: rankOf(r.school_id, r.group_code) || 99999 }
  })
}

function labelOf(schoolId) {
  const a = admOf(schoolId)
  if (!a?.years || !store.rankInfo.avgRank) return 'wen'
  const rng = schoolRankRange(a.years)
  return rng ? classify(store.rankInfo.avgRank, rng.best, rng.worst) : 'wen'
}

function addRow() {
  rows.value.push({ id: 'r' + Date.now(), school_id: '', group_code: '', majors: [], adjust: true, rank: 99999 })
}

function removeRow(i) { rows.value.splice(i, 1) }

function onSchoolChange(row) {
  row.school_id = row.school_id
  row.name = schoolOf(row.school_id)?.name || ''
  row.group_code = ''
  row.rank = rankOf(row.school_id, '')
  row.label = labelOf(row.school_id)
}

/* 合规校验 F8.1 */
const compliance = computed(() => {
  const errs = []
  if (rows.value.length === 0) errs.push('志愿表为空')
  if (rows.value.length > 30) errs.push(`志愿组数 ${rows.value.length} > 30`)
  rows.value.forEach((r, i) => {
    if (!r.school_id) errs.push(`第 ${i + 1} 行未选院校`)
    if (r.majors.filter(Boolean).length > 6) errs.push(`第 ${i + 1} 行专业数 > 6`)
  })
  if (!rows.value.every(r => r.adjust)) errs.push('存在未勾选服从调剂的志愿（冲/稳必服从）')
  // 梯度检查：位次是否倒挂
  const sorted = [...rows.value].sort((a, b) => a.rank - b.rank)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].rank > sorted[i - 1].rank * 1.15) {
      errs.push(`梯度可能过陡：${sorted[i - 1].name} → ${sorted[i].name}`)
      break
    }
  }
  return errs
})

/* F8.4 读取个人条件档案（F14，localStorage），叠加退档雷区提示 */
function readProfile() {
  try {
    const raw = localStorage.getItem('gaokao_profile')
    return raw ? JSON.parse(raw) : null
  } catch (e) { return null }
}
function riskOf(row) {
  const p = readProfile()
  const label = row.label
  const base = label === 'chong' && !row.adjust ? { level: 'red', text: '冲刺且不服从调剂 → 退档概率高（平行志愿只投一次）' }
    : label === 'wen' && !row.adjust ? { level: 'yellow', text: '稳妥位次但不服从调剂，仍有退档风险' }
    : label === 'bao' ? { level: 'green', text: '保底位次，即使不服从调剂风险较低' }
    : { level: 'green', text: '位次匹配且服从调剂，风险低' }
  // F8.4 退档雷区：身体条件 / 语种（需对照招生章程逐条核对）
  const extras = []
  if (p?.visionIssue && p.visionIssue !== '无') extras.push(`身体「${p.visionIssue}」请核对专业色觉/视力要求`)
  if (p?.bodyRestrict) extras.push(`身体「${p.bodyRestrict}」请核对招生章程`)
  if (p?.language && p.language !== '不限') extras.push(`语种「${p.language}」请核对专业限制`)
  if (extras.length) {
    return { level: base.level === 'green' ? 'yellow' : base.level, text: base.text + '｜退档雷区自查：' + extras.join('；') }
  }
  return base
}
const riskColor = { red: 'bg-red-50 border-red-300 text-red-700', yellow: 'bg-yellow-50 border-yellow-300 text-yellow-700', green: 'bg-green-50 border-green-300 text-green-700' }

/* 梯度瀑布图 F8.5 */
function renderWaterfall() {
  const el = document.getElementById('waterfall')
  if (!el) return
  const chart = echarts.getInstanceByDom(el) || echarts.init(el)
  const data = rows.value.filter(r => r.school_id).map(r => ({ name: r.name, rank: r.rank })).sort((a, b) => a.rank - b.rank)
  chart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 20, bottom: 10 },
    xAxis: { type: 'category', data: data.map(d => d.name), axisLabel: { rotate: 45, fontSize: 10, color: '#666' } },
    yAxis: { type: 'value', name: '位次（越小越好）', inverse: true, axisLabel: { color: '#666' } },
    series: [{ type: 'bar', data: data.map(d => d.rank), itemStyle: { color: '#1b1b1b' } }],
  })
}

/* 导出官方格式 F12.2 + F15 二次确认安全兜底 */
function exportOfficial() {
  const bad = compliance.value
  if (bad.length && !window.confirm(`⚠️ 当前志愿表存在 ${bad.length} 项合规性问题：\n${bad[0]}\n\n仍要导出吗？建议先修正。`)) return
  if (!window.confirm('导出前请逐项核对：\n' +
    '① 冲/稳志愿是否均已勾选「服从调剂」（不服从=进档后退档→直接掉批次）\n' +
    '② 各组专业是否均为同院校、同选科要求（调剂只限同专业组内）\n' +
    '③ 是否已自查退档雷区（单科/身体条件/语种→详见「个人档案」）\n\n' +
    '本工具数据仅供参考，最终以北京考试院及院校官方公布为准。确定导出？')) return
  const lines = ['志愿序号,院校专业组,专业1,专业2,专业3,专业4,专业5,专业6,服从调剂']
  rows.value.filter(r => r.school_id).forEach((r, i) => {
    lines.push([i + 1, r.name + (r.group_code ? '·组' + r.group_code : ''), ...r.majors.slice(0, 6).map(m => m || '').join(',') , r.adjust ? '是' : '否'].join(','))
  })
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = '官方格式志愿表.csv'
  a.click()
}
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 py-5 space-y-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <router-link to="/" class="text-blue-600 text-sm">← 首页</router-link>
        <h1 class="font-bold text-lg">志愿表沙盘（30 组 × 6 专业）</h1>
      </div>
      <div class="flex gap-2">
        <button @click="buildFromFav" class="px-3 py-1.5 rounded-lg border text-sm">从收藏导入</button>
        <button @click="addRow" class="px-3 py-1.5 rounded-lg border text-sm">+ 添加组</button>
        <button @click="exportOfficial" class="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-semibold">导出官方格式</button>
      </div>
    </div>

    <p v-if="loading" class="text-slate-400 text-center py-10">加载数据…</p>

    <template v-else>
      <!-- 合规校验结果 -->
      <div v-if="compliance.length" class="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700 space-y-1">
        <p class="font-semibold">合规性问题（{{ compliance.length }}）</p>
        <p v-for="(e, i) in compliance" :key="i">• {{ e }}</p>
      </div>
      <div v-else class="rounded-lg bg-green-50 border border-green-200 p-3 text-xs text-green-700 font-semibold">
        合规性校验通过：{{ rows.length }} 组 × ≤6 专业，均服从调剂，梯度合理。
      </div>

      <!-- 冲稳保配比 F8.2 -->
      <div class="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs">
        <p class="font-semibold text-blue-800">冲稳保配比建议（中分段就业导向 专业&gt;城市&gt;学校）：冲 9 : 稳 12 : 保 9</p>
        <p class="text-blue-700 mt-0.5">当前：冲 {{ rows.filter(r=>r.label==='chong').length }} · 稳 {{ rows.filter(r=>r.label==='wen').length }} · 保 {{ rows.filter(r=>r.label==='bao').length }}
          <span class="text-amber-700">｜冲/稳 必须服从调剂，保可灵活</span>
        </p>
      </div>

      <!-- 志愿表编辑 -->
      <div class="bg-white rounded-xl border overflow-x-auto">
        <table class="w-full text-sm min-w-[800px]">
          <thead class="bg-slate-50 text-xs text-slate-500">
            <tr><th class="p-2 text-left">#</th><th class="p-2 text-left w-40">院校（专业组）</th>
              <th class="p-2 text-left">专业 1–6</th><th class="p-2 w-20 text-center">冲稳保</th>
              <th class="p-2 w-16 text-center">服从调剂</th><th class="p-2 w-10"></th></tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in rows" :key="r.id" class="border-t">
              <td class="p-2 text-slate-400">{{ i + 1 }}</td>
              <td class="p-2">
                <input v-model="r.school_id" @change="onSchoolChange(r)" placeholder="school_id" class="w-28 border rounded px-1 py-0.5 text-xs" />
                <p class="text-[11px] text-slate-500">{{ r.name }}</p>
              </td>
              <td class="p-2">
                <div class="flex flex-wrap gap-1">
                  <input v-for="k in 6" :key="k" v-model="r.majors[k-1]" placeholder="专业" class="w-28 border rounded px-1 py-0.5 text-xs" />
                </div>
              </td>
              <td class="p-2 text-center">
                <span class="text-xs px-1.5 py-0.5 rounded" :class="r.label==='chong'?'bg-rose-100 text-rose-700':r.label==='bao'?'bg-sky-100 text-sky-700':'bg-emerald-100 text-emerald-700'">{{ {chong:'冲',wen:'稳',bao:'保'}[r.label] }}</span>
              </td>
              <td class="p-2 text-center"><input type="checkbox" v-model="r.adjust" class="accent-blue-600" /></td>
              <td class="p-2"><button @click="removeRow(i)" class="text-red-400 text-xs">移除</button></td>
            </tr>
            <tr v-if="!rows.length"><td colspan="6" class="p-6 text-center text-slate-400 text-sm">从收藏导入或手动添加志愿组</td></tr>
          </tbody>
        </table>
      </div>

      <!-- 风险扫描列表 -->
      <section class="space-y-1.5">
        <h3 class="font-semibold text-sm">调剂 / 退档风险扫描</h3>
        <p class="text-[11px] text-slate-400">调剂仅限同专业组内，不跨组不跨校；平行志愿只投档一次，退档直接掉批次。规则依据：北京考试院招生章程。</p>
        <div v-for="(r, i) in rows" :key="r.id" v-show="r.school_id"
          class="rounded-lg border px-3 py-2 text-xs" :class="riskColor[riskOf(r).level]">
          <span class="font-semibold">{{ i + 1 }}. {{ r.name }}</span> — {{ riskOf(r).text }}
        </div>
      </section>

      <!-- 梯度瀑布图 -->
      <section>
        <h3 class="font-semibold text-sm mb-2">梯度瀑布图（按位次排序，判断倒挂）</h3>
        <div id="waterfall" class="h-56 w-full"></div>
        <p v-if="!rows.filter(r=>r.school_id).length" class="text-xs text-slate-400">添加志愿后显示</p>
      </section>
    </template>

    <footer class="text-[11px] text-slate-400 text-center pt-2">风险扫描为规则化提示，最终以官方系统填报为准。导出前请核对。</footer>
  </div>
</template>