<script setup>
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useScoreStore } from '../stores/score'

const router = useRouter()
const store = useScoreStore()
const loading = ref(true)
const error = ref('')

const subjectOptions = ['物理', '化学', '生物', '历史', '政治', '地理']

function toggleSubject(s) {
  const i = store.subjects.indexOf(s)
  if (i >= 0) store.subjects.splice(i, 1)
  else store.subjects.push(s)
}

onMounted(async () => {
  try {
    await store.ensure()
  } catch (e) {
    error.value = '数据加载失败，请检查网络后刷新。' + e.message
  } finally {
    loading.value = false
  }
})

/* 填报倒计时（2027-07-01 填报截止） */
const countdown = computed(() => {
  const now = new Date()
  const fillStart = new Date('2027-06-27T00:00:00')
  const fillEnd = new Date('2027-07-01T23:59:59')
  if (now > fillEnd) return '2027 填报已结束'
  const dStart = Math.ceil((fillStart - now) / 86400000)
  const dEnd = Math.ceil((fillEnd - now) / 86400000)
  return { dStart: Math.max(0, dStart), dEnd: Math.max(0, dEnd), active: now >= fillStart }
})

function goSearch() {
  router.push({ path: '/schools', query: { score: store.score } })
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-6 space-y-5">
    <!-- 标题 -->
    <header class="text-center space-y-1">
      <h1 class="text-2xl sm:text-3xl font-bold text-slate-800">北京高考志愿决策助手</h1>
      <p class="text-sm text-slate-500">2027 届 · 物理+化学+历史 · 近三年官方数据 · 可离线</p>
    </header>

    <!-- 赋分认知卡 F11.2 -->
    <div class="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 space-y-1">
      <p class="font-semibold">赋分认知（北京等级赋分）</p>
      <p>化学、历史为再选科目，实行等级赋分（起点 40 分），最终分由全市排名换算，非卷面分。因此本工具以 <b>位次</b> 为核心依据（位次 &gt; 分数）。</p>
    </div>

    <!-- 填报倒计时 F12.1 -->
    <div class="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
      <template v-if="countdown.active">
        <span class="font-semibold">本科批填报进行中</span>（{{ new Date('2027-06-27').toLocaleDateString() }} ~ {{ new Date('2027-07-01').toLocaleDateString() }}）
      </template>
      <template v-else>
        <span class="font-semibold">距 2027 本科批首次填报（6/27–7/1）</span> 还有 {{ countdown.dStart }} 天（截止 {{ countdown.dEnd }} 天）
      </template>
      <p class="mt-1 text-amber-700">平行志愿只投档一次，退档不补投下一志愿 —— 冲/稳志愿务必勾选服从调剂。</p>
    </div>

    <!-- 分数输入 F1 -->
    <section class="bg-white rounded-xl border p-5 space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="font-semibold text-slate-800">输入分数</h2>
        <span class="text-xs text-slate-400">主攻区间 500–600</span>
      </div>

      <div class="flex items-center gap-4">
        <input
          type="range" min="380" max="700" v-model.number="store.score"
          class="flex-1 accent-blue-600"
          :class="{ 'outline outline-2 outline-amber-400': store.score < 500 || store.score > 600 }"
        />
        <input
          type="number" v-model.number="store.score" min="0" max="750"
          class="w-24 text-center text-xl font-bold border rounded-lg py-1"
        />
      </div>
      <p v-if="store.score < 500 || store.score > 600" class="text-xs text-amber-600">
        超出主攻区间（500–600），仍可查询，结果仅供参考。
      </p>

      <!-- 选科胶囊 -->
      <div>
        <p class="text-xs text-slate-500 mb-1.5">我的选科（{{ store.subjects.length }}/3）</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="s in subjectOptions" :key="s"
            @click="toggleSubject(s)"
            class="px-3 py-1.5 rounded-full border transition"
            :class="store.subjects.includes(s)
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-slate-600 border-slate-300'"
          >{{ s }}</button>
        </div>
        <p class="text-[11px] text-slate-400 mt-1">默认已选 物理+化学+历史（2027 届）；选科过滤将自动灰显不可报专业。</p>
      </div>

      <button
        @click="goSearch"
        :disabled="loading"
        class="w-full py-3 rounded-lg bg-blue-600 text-white font-semibold text-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {{ loading ? '加载数据…' : '查看可报院校' }}
      </button>
      <p v-if="error" class="text-xs text-red-500">{{ error }}</p>

      <!-- 三年等效分卡片 F1.2 -->
      <template v-if="!loading && store.rankInfo.rows.length">
        <div class="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm">
          <p class="font-semibold text-slate-700 mb-2">
            {{ store.score }} 分 → 近三年北京物理类位次区间
            <span v-if="store.rankInfo.avgRank" class="text-blue-600">（平均约 {{ store.rankInfo.avgRank }} 名）</span>
          </p>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div v-for="r in store.rankInfo.rows" :key="r.year" class="bg-white rounded-md border p-2">
              <p class="text-[11px] text-slate-400">{{ r.year }}</p>
              <p class="font-bold text-slate-800">{{ r.lo != null ? `${r.lo}–${r.hi}` : '—' }}</p>
            </div>
          </div>
          <p class="text-[11px] text-slate-400 mt-2">位次区间 = 一分一段表累计人数区间 [cum−count+1, cum]，为区间估计。</p>
        </div>
      </template>
    </section>

    <!-- 2027 选科动态 F11.1 -->
    <section class="rounded-lg bg-green-50 border border-green-200 p-3 text-xs text-green-800">
      <p class="font-semibold">2027 选科新变化（适用物化历）</p>
      <ul class="list-disc pl-4 mt-1 space-y-0.5">
        <li>临床医学等多数医学专业仍要求 物+化 → 你可报</li>
        <li>护理学部分院校放宽为仅需 化学 或 生物</li>
        <li>汉语言文学、法学等多为不限选科</li>
      </ul>
      <p class="mt-1 text-green-700">依据：2027 通用版选考科目要求（考试院 2025-02 公布）。</p>
    </section>

    <!-- 免责声明常驻 -->
    <footer class="text-[11px] text-slate-400 text-center leading-relaxed pt-2">
      数据来源于北京教育考试院、阳光高考平台及各高校招生网公开信息（2023–2025）。仅供志愿填报辅助参考，不构成录取承诺，最终以官方公布为准。
    </footer>
  </div>
</template>