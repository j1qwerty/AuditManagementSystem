// Tiny promise-based IndexedDB wrapper.
// All application data lives here (browser-local); no server involved.
import config from './config'

export const STORES = [
  'users', 'departments', 'audits', 'findings', 'observations',
  'documents', 'files', 'messages', 'notifications', 'activity',
  'transactions', 'reports', 'templates', 'integrations', 'checklistTemplates',
  'emailOutbox', 'teams', 'loginEvents', 'rolePermissions'
]

let dbPromise = null

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(config.dbName, config.dbVersion)
    req.onupgradeneeded = (e) => {
      const db = req.result
      STORES.forEach((s) => {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' })
      })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx(store, mode, fn) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode)
        const os = t.objectStore(store)
        const result = fn(os)
        t.oncomplete = () => resolve(result && result.result !== undefined ? result.result : result)
        t.onerror = () => reject(t.error)
      })
  )
}

export const idb = {
  getAll(store) {
    return tx(store, 'readonly', (os) => os.getAll()).then((r) => r || [])
  },
  get(store, id) {
    return tx(store, 'readonly', (os) => os.get(id)).then((r) => r || null)
  },
  put(store, obj) {
    return tx(store, 'readwrite', (os) => os.put(obj)).then(() => obj)
  },
  bulkPut(store, arr) {
    return openDB().then(
      (db) =>
        new Promise((resolve, reject) => {
          const t = db.transaction(store, 'readwrite')
          const os = t.objectStore(store)
          arr.forEach((o) => os.put(o))
          t.oncomplete = () => resolve(true)
          t.onerror = () => reject(t.error)
        })
    )
  },
  del(store, id) {
    return tx(store, 'readwrite', (os) => os.delete(id)).then(() => true)
  },
  clear(store) {
    return tx(store, 'readwrite', (os) => os.clear()).then(() => true)
  },
  clearAll() {
    return Promise.all(STORES.map((s) => this.clear(s)))
  },
  async estimateUsage() {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate()
        return est
      }
    } catch (e) { /* not supported */ }
    return { usage: null, quota: null }
  }
}

export default idb
