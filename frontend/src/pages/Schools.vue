<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useScoreStore } from '../stores/score'
import { loadL1 } from '../lib/data'
import { schoolRankRange, classify } from '../lib/core'

const route = useRoute()
const router = useRouter()
const store = useScoreStore()

const loading = ref(true)
const error = ref('')
const schools = ref([]) // {school, range}
const filter = ref({ province: '全部', tier: '全部', label: '全部' })

const provList = ['全部']
const tierOptions = ['全部', '985', '211', '双一流']
const labelOptions = ['全部', '冲', '稳', '保']

onMounted(async () => {
  try {
    await store.ensure()
    const l1 = await loadL1()
    const admMap = new Map(l1.admissions.map(a => [a.name, a]))
    const all = l1.schools
      .map(s => {
        const a = admMap.get(s.name)
        if (!a) return null
        const range = schoolRankRange(a.years)
        if (!range) return null
        return { school: { ...s, years: a.years }, range }
      })
      .filter(Boolean)
    schools.value = all
    // province list
    const ps = new Set(all.map(x => x.school.province))
    provList.push(...[...ps].sort())
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

const avgRank = computed(() => store.rankInfo.avgRank)

const grouped = computed(() => {
  const res = { chong: [], wen: [], bao: [] }
  for (const x of schools.value) {
    if (filter.value.province !== '全部' && x.school.province !== filter.value.province) continue
    if (filter.value.tier !== '全部' && !(x.school.tier || []).includes(filter.value.tier)) continue
    const cls = classify(avgRank.value, x.range.best, x.range.worst)
    const label = { chong: '冲', wen: '稳', bao: '保' }[cls]
    if (filter.value.label !== '全部' && label !== filter.value.label) continue
    res[cls].push({ ...x, label })
  }
  // F2.4 缺年数据防御：years 可能含 null/缺字段，缺值按 Infinity 处理不崩
  const minScoreOfYears = (yrs) => {
    if (!yrs) return null
    const vals = Object.values(yrs).map(y => (y && typeof y.min_score === 'number') ? y.min_score : Infinity)
    return vals.some(v => v !== Infinity) ? Math.min(...vals) : null
  }
  const byScore = (arr) => arr.sort((a, b) => {
    const minA = minScoreOfYears(a.school.years) ?? 0
    const minB = minScoreOfYears(b.school.years) ?? 0
    return minB - minA
  })
  return { chong: byScore(res.chong), wen: byScore(res.wen), bao: byScore(res.bao) }
})

const counts = computed(() => ({
  chong: grouped.value.chong.length,
  wen: grouped.value.wen.length,
  bao: grouped.value.bao.length,
}))

function tierBadges(t) {
  const order = ['985', '211', '双一流']
  return (t || []).filter(x => order.includes(x)).slice(0, 3)
}

function minScoreOf(s) {
  const vals = Object.values(s.years || {}).map(y => (y && typeof y.min_score === 'number') ? y.min_score : null).filter(v => v != null)
  return vals.length ? Math.min(...vals) : '—'
}

/* F5.3 对比：最多 4 所，底部抽屉并排比较 */
const compareList = ref([])
function toggleCompare(x) {
  const i = compareList.value.indexOf(x)
  if (i >= 0) { compareList.value.splice(i, 1); return }
  if (compareList.value.length >= 4) { alert('最多同时对比 4 所院校'); return }
  compareList.value.push(x)
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 py-5 space-y-4">
    <div class="flex items-center gap-2">
      <router-link to="/" class="text-blue-600 text-sm">← 首页</router-link>
      <h1 class="font-bold text-lg text-slate-800">可报院校（{{ store.score }} 分 · 平均位次 {{ avgRank }}）</h1>
    </div>

    <!-- 筛选栏 F4 -->
    <div class="flex flex-wrap gap-2 text-sm">
      <select v-model="filter.province" class="border rounded px-2 py-1 bg-white">
        <option v-for="p in provList" :key="p">{{ p }}</option>
      </select>
      <select v-model="filter.tier" class="border rounded px-2 py-1 bg-white">
        <option v-for="t in tierOptions" :key="t">{{ t }}</option>
      </select>
      <select v-model="filter.label" class="border rounded px-2 py-1 bg-white">
        <option v-for="t in labelOptions" :key="t">{{ t }}</option>
      </select>
      <span class="text-xs text-slate-400 self-center">冲 {{ counts.chong }} · 稳 {{ counts.wen }} · 保 {{ counts.bao }}</span>
    </div>

    <p v-if="error" class="text-red-500 text-sm">加载失败：{{ error }}</p>

    <!-- 三色分段 -->
    <template v-if="!loading">
      <section v-for="grp in [['冲','chong','bg-rose-50 border-rose-200 text-rose-700'],['稳','wen','bg-emerald-50 border-emerald-200 text-emerald-700'],['保','bao','bg-sky-50 border-sky-200 text-sky-700']]" :key="grp[1]">
        <header class="flex items-center gap-2 mb-2">
          <span class="font-bold rounded px-2 py-0.5 border text-xs" :class="grp[2]">
            {{ grp[0] }}（{{ grouped[grp[1]].length }}）
          </span>
          <span v-if="grp[1]==='chong'" class="text-[11px] text-slate-400">本人位次优于该校历史最优 → 可冲</span>
          <span v-else-if="grp[1]==='wen'" class="text-[11px] text-slate-400">位次落在区间内 → 较稳</span>
          <span v-else class="text-[11px] text-slate-400">位次劣于历史最差 → 保底</span>
        </header>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <router-link
            v-for="x in grouped[grp[1]]" :key="x.school.school_id"
            :to="`/school/${x.school.school_id}`"
            class="bg-white border rounded-lg p-3 hover:shadow-md transition space-y-1 block"
          >
            <div class="flex items-center justify-between">
              <h3 class="font-semibold text-slate-800">{{ x.school.name }}</h3>
              <span class="text-[10px] text-slate-400">{{ x.school.province }}</span>
            </div>
            <div class="flex gap-1">
              <span v-for="t in tierBadges(x.school.tier)" :key="t" class="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">{{ t }}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{{ x.school.nature }}</span>
            </div>
            <div class="flex justify-between text-xs text-slate-500">
              <span>近三年最低分：<b class="text-slate-700">{{ minScoreOf(x.school) }}</b></span>
              <span>位次 {{ x.range.best }}–{{ x.range.worst }}</span>
            </div>
            <button
              @click.prevent.stop="toggleCompare(x)"
              class="w-full text-[11px] mt-1 py-1 rounded border text-center"
              :class="compareList.includes(x) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'"
            >{{ compareList.includes(x) ? '已加入对比 ✓' : '加入对比' }}</button>
          </router-link>
        </div>
      </section>
    </template>
    <p v-else class="text-slate-400 text-sm py-8 text-center">数据加载中…</p>

    <!-- F5.3 对比抽屉 -->
    <div v-if="compareList.length" class="fixed bottom-0 inset-x-0 bg-white border-t shadow-2xl z-20 px-4 py-3">
      <div class="max-w-5xl mx-auto">
        <div class="flex items-center gap-3 mb-2">
          <span class="text-xs font-bold text-slate-700">对比（{{ compareList.length }}/4）</span>
          <button @click="compareList = []" class="text-[11px] text-blue-600 underline">清空对比</button>
          <span class="text-[11px] text-slate-400 ml-auto">"冲"=位次优于历史最优 · "稳"=落在区间内 · "保"=劣于历史最差</span>
        </div>
        <div class="flex gap-3 overflow-x-auto pb-1">
          <div v-for="c in compareList" :key="c.school.school_id" class="min-w-[190px] border rounded-lg p-2.5 space-y-1.5 text-xs bg-slate-50">
            <div class="flex items-start justify-between gap-2">
              <b class="text-slate-800">{{ c.school.name }}</b>
              <button @click="toggleCompare(c)" class="text-slate-400 hover:text-red-500">✕</button>
            </div>
            <div class="text-slate-500">{{ c.school.province }} · {{ c.school.nature }}</div>
            <div class="text-slate-500">层次：{{ (c.school.tier || []).join(' / ') || '—' }}</div>
            <div class="text-slate-500">近三年最低分：<b class="text-slate-700">{{ minScoreOf(c.school) }}</b></div>
            <div class="text-slate-500">位次区间：<b class="text-slate-700">{{ c.range.best }}–{{ c.range.worst }}</b></div>
            <div>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold"
                :class="c.label==='冲' ? 'bg-rose-100 text-rose-700' : c.label==='稳' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'">{{ c.label }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <footer class="text-[11px] text-slate-400 text-center pt-2">
      冲稳保分级基于三年位次区间（位次差，非分差）；"冲"录取概率低、"稳"适中、"保"高。数据仅供参考，以官方为准。
    </footer>
  </div>
</template>