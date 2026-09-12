import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')

// 可观测性：错误捕获
window.onerror = (msg, src, line) => {
  console.error('[gaokao-tool] window error:', msg, src, line)
}
app.config.errorHandler = (err, instance, info) => {
  console.error('[gaokao-tool] vue error:', info, err)
}