<script setup>
import { ref, computed, onMounted } from 'vue'
import { useScoreStore } from '../stores/score'
import { useFavoriteStore } from '../stores/favorites'
import { loadL1 } from '../lib/data'
import { classify, schoolRankRange } from '../lib/core'

const store = useScoreStore()
const fav = useFavoriteStore()
const schools = ref([])
const admissions = ref([])

onMounted(async () => {
  await store.ensure()
  const l1 = await loadL1()
  schools.value = l1.schools
  admissions.value = l1.admissions
})

function schoolOf(id) {
  return schools.value.find(s => s.school_id === id)
}

function catOf(item) {
  const a = admissions.value.find(x => x.school_id === item.school_id)
  if (!a?.years || !store.rankInfo.avgRank) return 'wen'
  const rng = schoolRankRange(a.years)
  return rng ? classify(store.rankInfo.avgRank, rng.best, rng.worst) : 'wen'
}

/* 配比建议 F5.1 / F8.2 */
const ratio = computed(() => {
  const n = fav.items.length
  if (!n) return null
  const c = fav.items.filter(i => catOf(i) === 'chong').length
  const w = fav.items.filter(i => catOf(i) === 'wen').length
  const b = fav.items.filter(i => catOf(i) === 'bao').length
  return { n, c, w, b, pct: { c: Math.round(c / n * 100), w: Math.round(w / n * 100), b: Math.round(b / n * 100) } }
})

/* 导出 CSV F5.4 / F12.2 */
function exportCSV() {
  const rows = [['学校', '专业组', '专业', '冲稳保', '备注']]
  for (const it of fav.items) {
    const s = schoolOf(it.school_id)
    rows.push([s?.name || it.school_id, it.group_code || '', it.major, it.category || catOf(it), it.note || ''])
  }
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '高考志愿表_' + Date.now() + '.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function setCat(item, cat) {
  fav.setCategory(item.id, cat)
}
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 py-5 space-y-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <router-link to="/" class="text-blue-600 text-sm">← 首页</router-link>
        <h1 class="font-bold text-lg">我的志愿表（{{ fav.items.length }}）</h1>
      </div>
      <button @click="exportCSV" :disabled="!fav.items.length"
        class="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-semibold disabled:opacity-40">
        导出 CSV
      </button>
    </div>

    <!-- 配比建议 -->
    <div v-if="ratio" class="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm">
      <p class="font-semibold">建议配比：冲 3 : 稳 5 : 保 2（可配置）</p>
      <p class="text-xs text-slate-600 mt-1">
        当前：冲 {{ ratio.c }}（{{ ratio.pct.c }}%） · 稳 {{ ratio.w }}（{{ ratio.pct.w }}%） · 保 {{ ratio.b }}（{{ ratio.pct.b }}%）
      </p>
      <p class="text-[11px] text-amber-700 mt-1">北京规则：冲/稳志愿务必勾选服从调剂；退档不补投下一志愿。</p>
    </div>

    <div v-if="!fav.items.length" class="text-center text-slate-400 py-12">
      暂无收藏。前往院校列表，把心仪院校的专业加入志愿表。
    </div>

    <section v-for="(grp, key) in [['冲','chong','rose'],['稳','wen','emerald'],['保','bao','sky']]" :key="key[1]">
      <h2 class="font-semibold mb-2 text-slate-700">{{ key[0] }}（{{ fav.items.filter(i => (i.category || catOf(i)) === key[1]).length }}）</h2>
      <div class="space-y-2">
        <div v-for="it in fav.items.filter(i => (i.category || catOf(i)) === key[1])" :key="it.id"
          class="bg-white border rounded-lg p-3 flex items-center gap-3">
          <div class="flex-1">
            <p class="font-semibold text-sm">{{ schoolOf(it.school_id)?.name || it.school_id }}</p>
            <p class="text-xs text-slate-500">{{ it.major }}<template v-if="it.group_code">（组{{ it.group_code }}）</template></p>
            <p v-if="it.note" class="text-xs text-slate-400 mt-1">备注：{{ it.note }}</p>
          </div>
          <select :value="it.category || catOf(it)" @change="setCat(it, $event.target.value)"
            class="text-xs border rounded px-1 py-1">
            <option value="chong">冲</option><option value="wen">稳</option><option value="bao">保</option>
          </select>
          <button @click="fav.remove(it.school_id, it.major)" class="text-xs text-red-500">移除</button>
        </div>
      </div>
    </section>

    <footer class="text-[11px] text-slate-400 text-center pt-2">全部本地存储（IndexedDB），不上传。导出前请核对数据与官方系统。</footer>
  </div>
</template>