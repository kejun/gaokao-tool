import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  // GitHub Pages 子路径部署（https://kejun.github.io/gaokao-tool/）
  base: '/gaokao-tool/',
})
