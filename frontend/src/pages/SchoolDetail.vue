<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useScoreStore } from '../stores/score'
import { loadL1, buildSchoolSubjectIndex, loadSubject2027 } from '../lib/data'
import { isEligible } from '../lib/core'
import { useFavoriteStore } from '../stores/favorites'
import * as echarts from 'echarts'

const route = useRoute()
const router = useRouter()
const store = useScoreStore()
const fav = useFavoriteStore()

const school = ref(null)
const admissions = ref(null)
const majors = ref([])
const subject2027 = ref({})
const loading = ref(true)
const error = ref('')

const selectedSubjects = computed(() => store.subjects)

onMounted(async () => {
  try {
    await store.ensure()
    const l1 = await loadL1()
    const s27 = await loadSubject2027()
    subject2027.value = s27

    const id = route.params.id
    const s = l1.schools.find(x => x.school_id === id)
    const a = l1.admissions.find(x => x.school_id === id)
    if (!s) throw new Error('院校不存在')
    school.value = s
    admissions.value = a

    // 专业：按院校索引 O(1) 查询 + 选科要求（2027 通用版选科要求为专业级，无专业组概念）
    const idx = await buildSchoolSubjectIndex('北京')
    const list = idx.get(String(id)) || []
    majors.value = list.map(m => ({
      major_code: String(m.major_code),
      major: m.major,
      require_subjects: m.require,
      plan_count: null,
    }))

    // 趋势图
    setTimeout(renderTrend, 50)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

function trendData() {
  if (!admissions.value || !admissions.value.years) return []
  const years = [2023, 2024, 2025]
  return years
    .filter(y => admissions.value.years[y])
    .map(y => ({ year: y, score: admissions.value.years[y].min_score, rank: admissions.value.years[y].min_rank_hi }))
}

function renderTrend() {
  const el = document.getElementById('trend-chart')
  if (!el) return
  const data = trendData()
  const chart = echarts.init(el)
  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['最低分', '最低位次'], top: 0, textStyle: { color: '#666' } },
    grid: { left: 40, right: 50, top: 30, bottom: 20 },
    xAxis: { type: 'category', data: data.map(d => String(d.year)), axisLabel: { color: '#666' } },
    yAxis: [
      { type: 'value', name: '分数', axisLabel: { color: '#666' } },
      { type: 'value', name: '位次', inverse: true, axisLabel: { color: '#666' } },
    ],
    series: [
      { name: '最低分', type: 'line', data: data.map(d => d.score), smooth: true, itemStyle: { color: '#1b1b1b' }, lineStyle: { color: '#1b1b1b' } },
      { name: '最低位次', type: 'line', yAxisIndex: 1, data: data.map(d => d.rank), smooth: true, itemStyle: { color: '#9a9a9a' }, lineStyle: { color: '#9a9a9a' } },
    ],
  })
}

const ratio = computed(() => {
  if (!school.value) return 0
  return school.value.grad_rate
})

function isFav(majorKey) {
  return fav.has(school.value?.school_id, majorKey)
}
function toggleFav(major, groupCode) {
  const key = major.major
  if (fav.has(school.value.school_id, key)) fav.remove(school.value.school_id, key)
  else fav.add(school.value.school_id, key, major, groupCode)
}

function subject2027Note(m) {
  const key = `${school.value?.school_id}:${m.major_code}`
  return subject2027.value[key]
}

function tierBadges(t) {
  const order = ['985', '211', '双一流']
  return (t || []).filter(x => order.includes(x))
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 py-5 space-y-5">
    <div class="flex items-center gap-2">
      <router-link to="/schools" class="text-blue-600 text-sm">← 院校列表</router-link>
    </div>

    <p v-if="error" class="text-red-500">加载失败：{{ error }}</p>

    <template v-if="school">
      <!-- 学校画像 -->
      <section class="bg-white rounded-xl border p-5 space-y-2">
        <div class="flex items-start justify-between">
          <div>
            <h1 class="text-2xl font-bold text-slate-800">{{ school.name }}</h1>
            <p class="text-sm text-slate-500">{{ school.province }} · {{ school.city }} · {{ school.nature }}</p>
          </div>
          <div class="flex gap-1 flex-wrap justify-end">
            <span v-for="t in tierBadges(school.tier)" :key="t" class="text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">{{ t }}</span>
          </div>
        </div>

        <!-- 深造指标 F10 -->
        <div v-if="school.has_master || school.has_doctor || ratio" class="text-xs text-slate-600 grid grid-cols-3 gap-2 bg-slate-50 rounded-lg p-3">
          <div><p class="text-slate-400">保研率</p><p class="font-semibold">{{ ratio ? (ratio * 100).toFixed(0) + '%' : '—' }}</p></div>
          <div><p class="text-slate-400">硕博点</p><p class="font-semibold">{{ school.has_doctor ? '博士点' : school.has_master ? '硕士点' : '—' }}</p></div>
          <div><p class="text-slate-400">转专业</p><p class="font-semibold">{{ school.transfer_policy || '—' }}</p></div>
        </div>

        <!-- 三年位次趋势 F5.2 -->
        <div>
          <h3 class="text-sm font-semibold mb-2">近三年录取趋势（大小年判断）</h3>
          <div id="trend-chart" class="h-48 w-full"></div>
          <p v-if="!trendData().length" class="text-xs text-slate-400">暂无趋势数据</p>
        </div>
      </section>

      <!-- 可报专业表 F3 + 选科硬过滤 -->
      <section class="space-y-4">
        <h2 class="font-bold text-lg">可报专业（选科 {{ selectedSubjects.join('+') }}）</h2>
        <p v-if="majors.length" class="text-xs text-slate-500">共 {{ majors.length }} 个专业 · 灰色为选科不满足、不可报考</p>

        <div class="bg-white rounded-xl border p-4 space-y-2">
          <table class="w-full text-sm">
            <thead><tr class="text-left text-xs text-slate-400 border-b">
              <th class="py-1.5">专业</th><th>选科要求</th><th>计划数</th><th>2027 变化</th><th class="text-right">操作</th>
            </tr></thead>
            <tbody>
              <tr v-for="m in majors" :key="m.major"
                  :class="{ 'opacity-40': !isEligible(m.require_subjects, selectedSubjects) }">
                <td class="py-2">
                  {{ m.major }}
                  <span v-if="!isEligible(m.require_subjects, selectedSubjects)" class="text-[10px] text-red-500">不可报</span>
                </td>
                <td class="text-xs">
                  <span v-if="!m.require_subjects?.length" class="text-slate-400">不限</span>
                  <span v-else>{{ m.require_subjects.join('+') }}</span>
                </td>
                <td class="text-xs text-slate-500">{{ m.plan_count ?? '—' }}</td>
                <td class="text-xs">
                  <span v-if="subject2027Note(m)" class="text-green-600">{{ subject2027Note(m).note }}</span>
                  <span v-else class="text-slate-300">—</span>
                </td>
                <td class="text-right">
                  <button @click="toggleFav(m, null)"
                    class="text-xs px-2 py-1 rounded border"
                    :class="isFav(m.major) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-300'">
                    {{ isFav(m.major) ? '已收藏' : '收藏' }}
                  </button>
                </td>
              </tr>
              <tr v-if="!majors.length"><td colspan="5" class="text-slate-400 text-xs py-2">暂无该校正版选科数据（数据持续补充中）</td></tr>
            </tbody>
          </table>
          <p class="text-[11px] text-slate-400">不可报原因：选科不满足要求（{{ selectedSubjects.join('+') }} ⊆ {{ '专业要求' }}）。调剂仅限同专业组内，不跨组不跨校。</p>
        </div>
      </section>
    </template>
    <p v-else-if="loading" class="text-slate-400 py-8 text-center">加载中…</p>

    <footer class="text-[11px] text-slate-400 text-center pt-2">数据来源标注、免责声明：以官方公布为准。</footer>
  </div>
</template>