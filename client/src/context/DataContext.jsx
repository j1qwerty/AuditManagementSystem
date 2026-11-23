// Application data context.
// - Loads every IndexedDB store into React state
// - Seeds workspace data on first run (configurable via .env)
// - Every mutation persists to IndexedDB and is logged to the activity trail,
//   so no action in the app goes untracked.
// - BroadcastChannel keeps multiple tabs in sync (open two tabs as two users
//   and watch messages / comments / notifications update live).
import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react'
import idb from '../lib/db'
import ls from '../lib/storage'
import config from '../lib/config'
import { buildAllSeedData } from '../lib/seed'
import { uid, todayISO, stableIp, fmtDate } from '../lib/utils'
import { canDefault } from '../lib/permissions'
import { dispatchComms } from '../lib/comms'
import { useAuth } from './AuthContext'

const SEED_VERSION = '7' // bump to force a fresh seed on machines
const DATA_STORES = [
  'users', 'departments', 'audits', 'findings', 'observations', 'documents', 'messages',
  'notifications', 'activity', 'transactions', 'reports', 'templates', 'integrations',
  'emailOutbox', 'teams', 'loginEvents', 'rolePermissions', 'checklistTemplates', 'commsLogs'
]

const emptyData = Object.fromEntries(DATA_STORES.map((s) => [s, []]))
const DataContext = createContext(null)

export function DataProvider({ children }) {
  const { session } = useAuth()
  const [data, setData] = useState(emptyData)
  const [ready, setReady] = useState(false)
  const [toasts, setToasts] = useState([])
  const channelRef = useRef(null)

  const toast = useCallback((message, type = 'success') => {
    const id = uid('toast')
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800)
  }, [])

  // ---------------- boot: seed + load ----------------
  // Fault tolerant: a single broken object store never aborts the whole boot,
  // and if the workspace ends up without accounts (e.g. a database that had to
  // be healed after an upgrade) the seed is retried once before giving up.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const loadAll = async () => {
          const loaded = {}
          await Promise.all(
            DATA_STORES.map(async (s) => {
              try {
                loaded[s] = await idb.getAll(s)
              } catch (e) {
                console.warn(`Store "${s}" could not be read`, e)
                loaded[s] = []
              }
            })
          )
          return loaded
        }
        const runSeed = async () => {
          const seed = buildAllSeedData()
          await idb.clearAll()
          for (const store of Object.keys(seed)) {
            try {
              await idb.bulkPut(store, seed[store])
            } catch (e) {
              console.warn(`Store "${store}" could not be seeded`, e)
            }
          }
          ls.set('seeded_version', SEED_VERSION)
          // Verify the seed actually landed before recording it as complete -
          // a partial seed (schema was still being healed) is retried on the
          // next boot instead of leaving the workspace half-populated.
          let complete = true
          for (const store of Object.keys(seed)) {
            if (!seed[store].length) continue
            try {
              const rows = await idb.getAll(store)
              if (!rows || rows.length < seed[store].length) { complete = false; break }
            } catch (e) {
              complete = false
              break
            }
          }
          if (complete) ls.set('seed_integrity', SEED_VERSION)
          else ls.remove('seed_integrity')
          return complete
        }

        const seededVersion = ls.get('seeded_version')
        const seedIncomplete = ls.get('seed_integrity') !== SEED_VERSION
        const needsSeed =
          config.seedDemoData &&
          (seededVersion === null || seedIncomplete ||
            (config.resetOnVersionChange && seededVersion !== SEED_VERSION))
        let seededOk = true
        if (needsSeed) seededOk = await runSeed()

        let loaded = await loadAll()

        // safety net: seeding is on but no accounts made it into the database
        // (possible on a freshly healed schema) - retry the seed once.
        if (config.seedDemoData && (loaded.users.length === 0 || !seededOk)) {
          console.warn('Workspace seed incomplete - retrying the initial seed')
          await runSeed()
          loaded = await loadAll()
        }

        if (!cancelled) {
          setData((d) => ({ ...d, ...loaded }))
          setReady(true)
        }
      } catch (e) {
        console.error('Failed to initialise local database', e)
        setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // ---------------- cross-tab live sync ----------------
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const ch = new BroadcastChannel(config.syncChannel)
    channelRef.current = ch
    ch.onmessage = async (ev) => {
      const { store } = ev.data || {}
      if (store === '__all__') {
        const loaded = {}
        await Promise.all(DATA_STORES.map(async (s) => { loaded[s] = await idb.getAll(s) }))
        setData((d) => ({ ...d, ...loaded }))
      } else if (DATA_STORES.includes(store)) {
        const rows = await idb.getAll(store)
        setData((d) => ({ ...d, [store]: rows }))
      }
    }
    return () => {
      ch.close()
      channelRef.current = null
    }
  }, [])

  const broadcast = useCallback((store) => {
    try {
      if (channelRef.current) channelRef.current.postMessage({ store })
    } catch (e) { /* ignore */ }
  }, [])

  // ---------------- current user ----------------
  const currentUser = data.users.find((u) => u.id === (session && session.userId)) || null

  // users get a resolved deptName for pickers/filters
  const usersNamed = useMemo(
    () => data.users.map((u) => ({ ...u, deptName: (data.departments.find((d) => d.id === u.departmentId) || {}).name || null })),
    [data.users, data.departments]
  )

  // ---------------- editable permissions (RBAC) ----------------
  const permByRole = useMemo(() => {
    const map = {}
    data.rolePermissions.forEach((p) => { map[p.role] = p.actions || [] })
    return map
  }, [data.rolePermissions])

  const can = useCallback(
    (action) => {
      if (!currentUser) return false
      const list = permByRole[currentUser.role]
      if (list) return list.includes(action)
      return canDefault(currentUser, action)
    },
    [currentUser, permByRole]
  )

  const setRolePermissions = useCallback(
    async (role, actions) => {
      const rec = data.rolePermissions.find((p) => p.role === role) || { id: `perm_${role}`, role }
      await save('rolePermissions', { ...rec, actions }, { log: false })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.rolePermissions]
  )

  // ---------------- activity trail ----------------
  const logActivity = useCallback(
    async (action, entityType, entityId, details, remarks) => {
      const entry = {
        id: uid('act'),
        userId: currentUser ? currentUser.id : 'system',
        userName: currentUser ? currentUser.name : 'System',
        action,
        entityType,
        entityId,
        details: details || '',
        remarks: remarks || '',
        timestamp: todayISO(),
        location: 'Lucknow',
        ip: stableIp((currentUser ? currentUser.id : 'sys') + '|' + new Date().toDateString())
      }
      await idb.put('activity', entry)
      setData((d) => ({ ...d, activity: [entry, ...d.activity] }))
      broadcast('activity')
      return entry
    },
    [currentUser, broadcast]
  )

  // ---------------- generic CRUD ----------------
  const save = useCallback(
    async (store, obj, opts = {}) => {
      await idb.put(store, obj)
      setData((d) => {
        const exists = d[store].some((x) => x.id === obj.id)
        return { ...d, [store]: exists ? d[store].map((x) => (x.id === obj.id ? obj : x)) : [obj, ...d[store]] }
      })
      broadcast(store)
      if (opts.log !== false && opts.logAction) {
        await logActivity(opts.logAction, store, obj.id, opts.logDetail || '', opts.logRemarks)
      }
      return obj
    },
    [broadcast, logActivity]
  )

  const remove = useCallback(
    async (store, id, opts = {}) => {
      await idb.del(store, id)
      setData((d) => ({ ...d, [store]: d[store].filter((x) => x.id !== id) }))
      broadcast(store)
      if (opts.logAction) await logActivity(opts.logAction, store, id, opts.logDetail || '', opts.logRemarks)
    },
    [broadcast, logActivity]
  )

  const saveFile = useCallback(
    async (fileId, name, blob) => {
      await idb.put('files', { id: fileId, name, blob })
      return fileId
    },
    []
  )

  // ---------------- notifications ----------------
  const notify = useCallback(
    async (userIds, type, title, body, link, remarks) => {
      const list = Array.isArray(userIds) ? userIds : [userIds]
      const records = (list.includes('*') ? ['*'] : list).map((userId) => ({
        id: uid('n'),
        userId,
        type,
        title,
        body: body || '',
        remarks: remarks || '',
        timestamp: todayISO(),
        readBy: [],
        link: link || ''
      }))
      await idb.bulkPut('notifications', records)
      setData((d) => ({ ...d, notifications: [...records, ...d.notifications] }))
      broadcast('notifications')
      return records
    },
    [broadcast]
  )

  const markNotificationRead = useCallback(
    async (notif) => {
      if (!currentUser) return
      const readBy = Array.from(new Set([...(notif.readBy || []), currentUser.id]))
      const updated = { ...notif, readBy }
      await idb.put('notifications', updated)
      setData((d) => ({ ...d, notifications: d.notifications.map((n) => (n.id === notif.id ? updated : n)) }))
      broadcast('notifications')
    },
    [currentUser, broadcast]
  )

  const markAllNotificationsRead = useCallback(async () => {
    if (!currentUser) return
    const updated = data.notifications.map((n) =>
      (n.userId === '*' || n.userId === currentUser.id) && !(n.readBy || []).includes(currentUser.id)
        ? { ...n, readBy: [...(n.readBy || []), currentUser.id] }
        : n
    )
    await idb.bulkPut('notifications', updated)
    setData((d) => ({ ...d, notifications: updated }))
    broadcast('notifications')
  }, [data.notifications, currentUser, broadcast])

  const unreadCount = currentUser
    ? data.notifications.filter((n) => (n.userId === '*' || n.userId === currentUser.id) && !(n.readBy || []).includes(currentUser.id)).length
    : 0

  const unreadThreads = useMemo(() => {
    if (!currentUser) return new Set()
    return new Set(
      data.messages
        .filter((m) => m.from !== currentUser.id && (m.to || []).includes(currentUser.id) && !(m.readBy || []).includes(currentUser.id))
        .map((m) => m.threadId)
    )
  }, [data.messages, currentUser])

  // ---------------- email gateway ----------------
  const sendEmail = useCallback(
    async (to, subject, body) => {
      if (!config.emailSimulation) return
      const entry = { id: uid('e'), to, subject, body, timestamp: todayISO(), via: 'Email gateway' }
      await idb.put('emailOutbox', entry)
      setData((d) => ({ ...d, emailOutbox: [entry, ...d.emailOutbox] }))
      broadcast('emailOutbox')
    },
    [broadcast]
  )

  // ---------------- automatic follow-up engine ----------------
  // Overdue observations automatically receive reminders (coordinator + audit
  // lead, at most once every 3 days) and open observations overdue by 14+ days
  // are automatically escalated to level 1 (once). Every automatic action is
  // written to the communication log, the observation history, the activity
  // trail and sends notifications - exactly like a manual action would.
  const autoRanRef = useRef(false)
  useEffect(() => {
    if (!ready || autoRanRef.current || !data.observations.length || !data.users.length) return
    autoRanRef.current = true
    ;(async () => {
      const now = Date.now()
      for (const o of data.observations) {
        try {
          if (o.status === 'Resolved') continue
          const overdueDays = Math.floor((now - new Date(o.dueDate).getTime()) / 86400000)
          if (overdueDays < 3) continue
          let current = o
          const audit = data.audits.find((a) => a.id === o.auditId)
          const coord = data.users.find((u) => u.role === 'coordinator' && u.departmentId === o.departmentId && u.status === 'Active')
          const lead = audit ? data.users.find((u) => u.id === audit.leadAuditorId && u.status === 'Active') : null
          const lastAuto = o.lastAutoReminderAt ? new Date(o.lastAutoReminderAt).getTime() : 0

          // automatic reminder (3-day cooling period)
          if (now - lastAuto > 3 * 86400000) {
            const targets = [coord, lead].filter(Boolean).map((u) => ({ userId: u.id, name: u.name, role: u.role, email: u.email }))
            if (targets.length) {
              const remark = `Automatic reminder: response overdue by ${overdueDays} days (due ${fmtDate(o.dueDate)}).`
              await dispatchComms(
                { save, notify, sendEmail, currentUser: null },
                {
                  kind: 'Reminder', mode: 'Automatic', contextType: 'Observation', contextId: o.id,
                  auditId: o.auditId, title: o.title, recipients: targets, remark,
                  link: audit ? `#/audit/${o.auditId}` : '#/compliance',
                  notifyTitle: `Automatic reminder: ${o.title}`,
                  notifyBody: `${audit ? audit.code + ' · ' : ''}Response overdue by ${overdueDays} days — sent automatically by the system.`,
                  fromOverride: { userId: 'system', name: 'System', role: 'system' },
                  email: false
                }
              )
              const upd = {
                ...current,
                remindersSent: (current.remindersSent || 0) + 1,
                lastAutoReminderAt: todayISO(),
                history: [...(current.history || []), { date: todayISO(), event: `Automatic reminder sent by the system to ${targets.map((t) => t.name).join(', ')} — response overdue by ${overdueDays} days` }]
              }
              current = upd
              await save('observations', upd, { logAction: 'Automatic reminder sent', logDetail: `${o.title} — overdue by ${overdueDays} days`, logRemarks: remark })
            }
          }

          // automatic escalation (once, level 1, 14+ days overdue, never escalated)
          if (overdueDays >= 14 && !o.escalationLevel && !o.autoEscalatedAt) {
            const escTargets = [coord, ...data.users.filter((u) => ['cao', 'director'].includes(u.role) && u.status === 'Active')]
              .filter(Boolean)
              .map((u) => ({ userId: u.id, name: u.name, role: u.role, email: u.email }))
            const remark = `Automatic escalation: open observation overdue by ${overdueDays} days without a compliance response (due ${fmtDate(o.dueDate)}).`
            if (escTargets.length) {
              await dispatchComms(
                { save, notify, sendEmail, currentUser: null },
                {
                  kind: 'Escalation', mode: 'Automatic', contextType: 'Observation', contextId: o.id,
                  auditId: o.auditId, title: o.title, recipients: escTargets, remark,
                  level: 1, escalatedTo: 'Department Director',
                  link: audit ? `#/audit/${o.auditId}` : '#/compliance',
                  notifyTitle: `Automatic escalation: ${o.title}`,
                  notifyBody: `${audit ? audit.code + ' · ' : ''}Overdue by ${overdueDays} days — escalated to Level 1 (Department Director) automatically.`,
                  fromOverride: { userId: 'system', name: 'System', role: 'system' },
                  email: false
                }
              )
              const upd = {
                ...current,
                status: 'Escalated',
                escalationLevel: 1,
                escalatedTo: 'Department Director',
                escalatedAt: todayISO(),
                escalationRemarks: remark,
                autoEscalatedAt: todayISO(),
                history: [...(current.history || []), { date: todayISO(), event: `Automatically escalated to Level 1 (Department Director) — overdue by ${overdueDays} days` }]
              }
              await save('observations', upd, { logAction: 'Automatic escalation', logDetail: `${o.title} → Level 1`, logRemarks: remark })
            }
          }
        } catch (e) { /* keep the engine resilient */ }
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, data.observations, data.users, data.audits])

  // ---------------- workspace data reset ----------------
  const resetWorkspaceData = useCallback(async () => {
    await idb.clearAll()
    const seed = buildAllSeedData()
    for (const store of Object.keys(seed)) await idb.bulkPut(store, seed[store])
    ls.set('seeded_version', SEED_VERSION)
    const loaded = {}
    await Promise.all(DATA_STORES.map(async (s) => { loaded[s] = await idb.getAll(s) }))
    setData((d) => ({ ...d, ...loaded }))
    broadcast('__all__')
  }, [broadcast])

  const wipeAllData = useCallback(async () => {
    await idb.clearAll()
    ls.remove('seeded_version')
    setData(emptyData)
    broadcast('__all__')
  }, [broadcast])

  const importData = useCallback(
    async (json) => {
      const parsed = typeof json === 'string' ? JSON.parse(json) : json
      for (const store of DATA_STORES) {
        if (Array.isArray(parsed[store])) await idb.bulkPut(store, parsed[store])
      }
      const loaded = {}
      await Promise.all(DATA_STORES.map(async (s) => { loaded[s] = await idb.getAll(s) }))
      setData((d) => ({ ...d, ...loaded }))
      broadcast('__all__')
    },
    [broadcast]
  )

  const exportData = useCallback(() => {
    const dump = {}
    DATA_STORES.forEach((s) => (dump[s] = data[s]))
    dump.__exportedAt = new Date().toISOString()
    dump.__app = config.appName
    return JSON.stringify(dump, null, 2)
  }, [data])

  const value = {
    data, ready, currentUser, usersNamed,
    save, remove, saveFile, logActivity, can, setRolePermissions,
    notify, markNotificationRead, markAllNotificationsRead, unreadCount, unreadThreads,
    sendEmail, toast, toasts,
    resetWorkspaceData, wipeAllData, importData, exportData
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  return useContext(DataContext)
}
