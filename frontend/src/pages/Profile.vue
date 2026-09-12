<script setup>
import { ref, onMounted, watch } from 'vue'

const profile = ref({
  realScore: null,
  realRank: null,
  chinese: null,
  math: null,
  english: null,
  physics: null,
  chemistry: null,
  history: null,
  visionIssue: '',       // 视力/色觉
  bodyRestrict: '',      // 其他身体限制
  language: '不限',       // 外语语种
  bonus: '',             // 加分项
})
const saved = ref(false)

const LANGS = ['不限', '英语', '日语', '俄语', '德语', '法语', '西班牙语']

onMounted(() => {
  const raw = localStorage.getItem('gaokao_profile')
  if (raw) {
    try { profile.value = { ...profile.value, ...JSON.parse(raw) } } catch (e) {}
  }
})

watch(profile, () => {
  localStorage.setItem('gaokao_profile', JSON.stringify(profile.value))
  saved.value = true
  setTimeout(() => (saved.value = false), 1500)
}, { deep: true })

function clearAll() {
  if (!confirm('确定清空个人档案？')) return
  profile.value = { realScore: null, realRank: null, chinese: null, math: null, english: null, physics: null, chemistry: null, history: null, visionIssue: '', bodyRestrict: '', language: '不限', bonus: '' }
  localStorage.removeItem('gaokao_profile')
}

/* 隐私声明：全部本地存储 */
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 py-5 space-y-5">
    <div class="flex items-center gap-2">
      <router-link to="/" class="text-blue-600 text-sm">← 首页</router-link>
      <h1 class="font-bold text-lg">个人条件档案</h1>
      <span v-if="saved" class="text-xs text-green-600">已保存</span>
    </div>

    <div class="rounded-lg bg-indigo-50 border border-indigo-200 p-3 text-xs text-indigo-800">
      所有数据仅存储在本浏览器（localStorage），<b>绝不上传</b>。用于精准的退档/调剂风险扫描（F8.4 / F14）。
    </div>

    <section class="bg-white rounded-xl border p-4 space-y-4">
      <h2 class="font-semibold text-sm border-b pb-2">高考成绩</h2>
      <div class="grid grid-cols-3 gap-3">
        <label class="text-xs text-slate-500">总分<input v-model.number="profile.realScore" type="number" min="0" max="750" class="mt-1 w-full border rounded px-2 py-1 text-sm" placeholder="如 560" /></label>
        <label class="text-xs text-slate-500">全市位次<input v-model.number="profile.realRank" type="number" class="mt-1 w-full border rounded px-2 py-1 text-sm" placeholder="如 18000" /></label>
        <label class="text-xs text-slate-500">外语语种
          <select v-model="profile.language" class="mt-1 w-full border rounded px-2 py-1 text-sm bg-white">
            <option v-for="l in LANGS" :key="l">{{ l }}</option>
          </select>
        </label>
      </div>
      <div class="grid grid-cols-3 gap-3 text-xs text-slate-500">
        <label>语文<input v-model.number="profile.chinese" type="number" min="0" max="150" class="mt-1 w-full border rounded px-2 py-1 text-sm" /></label>
        <label>数学<input v-model.number="profile.math" type="number" min="0" max="150" class="mt-1 w-full border rounded px-2 py-1 text-sm" /></label>
        <label>英语<input v-model.number="profile.english" type="number" min="0" max="150" class="mt-1 w-full border rounded px-2 py-1 text-sm" /></label>
        <label>物理<input v-model.number="profile.physics" type="number" min="0" max="100" class="mt-1 w-full border rounded px-2 py-1 text-sm" /></label>
        <label>化学（赋分）<input v-model.number="profile.chemistry" type="number" min="40" max="100" class="mt-1 w-full border rounded px-2 py-1 text-sm" /></label>
        <label>历史（赋分）<input v-model.number="profile.history" type="number" min="40" max="100" class="mt-1 w-full border rounded px-2 py-1 text-sm" /></label>
      </div>
      <p class="text-[11px] text-slate-400">化学/历史为等级赋分（起点 40 分），卷面分 ≠ 最终分。</p>
    </section>

    <section class="bg-white rounded-xl border p-4 space-y-3">
      <h2 class="font-semibold text-sm border-b pb-2">身体条件 / 退档雷区自查</h2>
      <label class="block text-xs text-slate-500">视力 / 色觉
        <input v-model="profile.visionIssue" class="mt-1 w-full border rounded px-2 py-1 text-sm" placeholder="如：色弱 / 色盲 / 近视 ≥800° / 无" />
      </label>
      <label class="block text-xs text-slate-500">其他身体限制
        <input v-model="profile.bodyRestrict" class="mt-1 w-full border rounded px-2 py-1 text-sm" placeholder="如：乙肝携带 / 身高 / 无" />
      </label>
      <label class="block text-xs text-slate-500">加分项
        <input v-model="profile.bonus" class="mt-1 w-full border rounded px-2 py-1 text-sm" placeholder="如：少数民族加分 5 分 / 无" />
      </label>
      <div class="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-[11px] text-amber-800">
        对照招生章程自查：单科不低于 X 分、色觉限制专业（临床医学、化工等）、语种限制（部分外语专业仅英语）。任一不符 → 该专业组志愿无效，务必提前剔除。
      </div>
    </section>

    <div class="flex gap-2">
      <button @click="clearAll" class="px-3 py-1.5 rounded-lg border border-red-200 text-red-500 text-sm">清空档案</button>
      <p class="text-[11px] text-slate-400 self-center">档案驱动志愿表沙盘的退档风险扫描；建议成绩公布后立即录入。</p>
    </div>
  </div>
</template>