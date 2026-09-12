<script setup>
const nav = [
  { to: '/', label: '首页' },
  { to: '/planner', label: '志愿表沙盘' },
  { to: '/favorites', label: '收藏夹' },
  { to: '/profile', label: '个人档案' },
]
</script>

<template>
  <div class="min-h-screen bg-slate-100 text-slate-800">
    <nav class="bg-white border-b sticky top-0 z-10">
      <div class="max-w-6xl mx-auto px-4 flex items-center gap-6 overflow-x-auto">
        <router-link to="/" class="brand whitespace-nowrap font-semibold text-slate-800 py-2.5">
          志愿决策助手
        </router-link>
        <div class="flex items-center gap-1">
          <router-link v-for="n in nav" :key="n.to" :to="n.to"
            class="px-3 py-2.5 text-sm whitespace-nowrap border-b-2 hover:text-blue-600"
            :class="$route.path.startsWith(n.to) ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-slate-500'">
            {{ n.label }}
          </router-link>
        </div>
      </div>
    </nav>
    <main class="flex-1">
      <router-view />
    </main>
  </div>
</template>