import { defineStore } from 'pinia'

function load() {
  const raw = localStorage.getItem('gaokao_favs')
  if (!raw) return []
  try { return JSON.parse(raw) } catch (e) { return [] }
}
function save(items) {
  localStorage.setItem('gaokao_favs', JSON.stringify(items))
}

export const useFavoriteStore = defineStore('favorites', {
  state: () => ({
    items: load(),
  }),
  actions: {
    add(schoolId, major, majorInfo, groupCode) {
      if (this.has(schoolId, major)) return
      this.items.push({
        id: `${schoolId}|${major}`,
        school_id: schoolId,
        group_code: groupCode || '',
        major,
        category: 'wen',
        note: '',
        added_at: Date.now(),
      })
      save(this.items)
    },
    remove(schoolId, major) {
      this.items = this.items.filter(i => !(i.school_id === schoolId && i.major === major))
      save(this.items)
    },
    has(schoolId, major) {
      return this.items.some(i => i.school_id === schoolId && i.major === major)
    },
    setCategory(id, cat) {
      const it = this.items.find(i => i.id === id)
      if (it) { it.category = cat; save(this.items) }
    },
    setNote(id, note) {
      const it = this.items.find(i => i.id === id)
      if (it) { it.note = note; save(this.items) }
    },
  },
})