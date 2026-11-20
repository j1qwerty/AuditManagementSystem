// localStorage helpers - used for the session, small app settings and flags.
// Entity data lives in IndexedDB (see db.js).
import config from './config'

const p = config.storagePrefix

export const ls = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(`${p}_${key}`)
      return raw === null ? fallback : JSON.parse(raw)
    } catch (e) {
      return fallback
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`${p}_${key}`, JSON.stringify(value))
      return true
    } catch (e) {
      return false
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(`${p}_${key}`)
    } catch (e) { /* ignore */ }
  },
  // app settings object (merged with defaults)
  getSettings(defaults) {
    return { ...defaults, ...(ls.get('settings') || {}) }
  },
  saveSettings(settings) {
    ls.set('settings', settings)
    return settings
  }
}

export default ls
