// Tiny promise-based IndexedDB wrapper.
// All application data lives here (browser-local); no server involved.
// The open routine is self-healing: an existing database created by an older
// build of the app may sit at the same version number yet lack newer object
// stores (e.g. commsLogs). Whenever a store is missing we transparently reopen
// the database one version higher, which runs onupgradeneeded and creates it -
// no manual reset is ever needed on machines that ran an older build.
import config from './config'

export const STORES = [
  'users', 'departments', 'audits', 'findings', 'observations',
  'documents', 'files', 'messages', 'notifications', 'activity',
  'transactions', 'reports', 'templates', 'integrations', 'checklistTemplates',
  'emailOutbox', 'teams', 'loginEvents', 'rolePermissions', 'commsLogs'
]

let dbPromise = null

function openAtVersion(version) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(config.dbName, version)
    req.onupgradeneeded = () => {
      const db = req.result
      STORES.forEach((s) => {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' })
      })
    }
    req.onsuccess = () => {
      const db = req.result
      // allow other tabs to upgrade the schema: release the connection when
      // someone else asks for a newer version
      db.onversionchange = () => db.close()
      resolve(db)
    }
    req.onerror = () => reject(req.error)
    // another tab holds an older connection open; it closes itself on
    // versionchange, after which this request continues automatically
    req.onblocked = () => { /* wait quietly */ }
  })
}

async function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = (async () => {
    let db
    try {
      db = await openAtVersion(config.dbVersion)
    } catch (e) {
      // The on-disk database is NEWER than what this build asks for
      // (VersionError - e.g. the machine ran a newer build earlier). Open
      // without a version to inspect it, then heal below if needed.
      try {
        db = await new Promise((resolve, reject) => {
          const req = indexedDB.open(config.dbName)
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
      } catch (e2) {
        throw e
      }
    }
    // Self-heal: the database may be at the same (or a newer) version yet
    // miss stores this build needs. Reopen one version higher - that always
    // runs onupgradeneeded and creates whatever is missing.
    const missing = STORES.filter((s) => !db.objectStoreNames.contains(s))
    if (missing.length) {
      const nextVersion = db.version + 1
      db.close()
      db = await openAtVersion(nextVersion)
    }
    return db
  })()
  return dbPromise
}

function tx(store, mode, fn) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        // a store may still be absent on a badly damaged database - reads
        // degrade gracefully instead of failing the whole workspace boot
        if (!db.objectStoreNames.contains(store)) {
          if (mode === 'readonly') return resolve(undefined)
          return reject(new Error(`Object store "${store}" is unavailable`))
        }
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
          if (!db.objectStoreNames.contains(store)) return resolve(false)
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
    return tx(store, 'readwrite', (os) => os.clear())
      .then(() => true)
      .catch(() => false)
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
