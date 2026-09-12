import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'home', component: () => import('../pages/Home.vue') },
  { path: '/schools', name: 'schools', component: () => import('../pages/Schools.vue') },
  { path: '/school/:id', name: 'school-detail', component: () => import('../pages/SchoolDetail.vue') },
  { path: '/planner', name: 'planner', component: () => import('../pages/Planner.vue') },
  { path: '/favorites', name: 'favorites', component: () => import('../pages/Favorites.vue') },
  { path: '/profile', name: 'profile', component: () => import('../pages/Profile.vue') },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router