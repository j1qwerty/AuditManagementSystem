// Shared utilities: ids, dates, INR formatting, misc helpers.

let idCounter = 0
export function uid(prefix = 'id') {
  idCounter += 1
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

// ---------- dates ----------
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function fmtDate(d) {
  if (!d) return '-'
  const dt = new Date(d)
  if (isNaN(dt)) return '-'
  return `${String(dt.getDate()).padStart(2, '0')} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`
}

export function fmtDateTime(d) {
  if (!d) return '-'
  const dt = new Date(d)
  if (isNaN(dt)) return '-'
  let h = dt.getHours()
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${fmtDate(dt)}, ${h}:${String(dt.getMinutes()).padStart(2, '0')} ${ampm}`
}

export function fmtMonth(d) {
  const dt = new Date(d)
  return `${MONTHS[dt.getMonth()]} ${String(dt.getFullYear()).slice(2)}`
}

export function isoDaysAgo(days, hour = 10, minute = 30) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

export function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000)
}

export function daysFromNow(d) {
  if (!d) return null
  return daysBetween(new Date().setHours(0, 0, 0, 0), new Date(d).setHours(0, 0, 0, 0))
}

export function isOverdue(d) {
  if (!d) return false
  return daysFromNow(d) < 0
}

export function fmtRelative(d) {
  if (!d) return '-'
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return fmtDate(d)
}

// ---------- money (Indian format) ----------
export function fmtINR(n) {
  if (n === null || n === undefined || isNaN(Number(n))) return '-'
  n = Number(n)
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

// Compact Indian format: ₹1.25 Cr / ₹48.6 L / ₹900
export function fmtINRCompact(n) {
  if (n === null || n === undefined || isNaN(Number(n))) return '-'
  n = Number(n)
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2).replace(/\.?0+$/, '')} Cr`
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1).replace(/\.0$/, '')} L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`
  return `₹${n}`
}

export function fmtBytes(bytes) {
  if (!bytes && bytes !== 0) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

// ---------- misc ----------
export function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

export function initials(name) {
  if (!name) return '?'
  return name.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

export function pct(v) {
  if (v === null || v === undefined || isNaN(Number(v))) return '-'
  return `${Math.round(Number(v))}%`
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 3000)
}

export function groupBy(arr, fn) {
  return arr.reduce((acc, item) => {
    const key = fn(item)
    ;(acc[key] = acc[key] || []).push(item)
    return acc
  }, {})
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

// stable pseudo-random from a string seed (used for demo data derivation)
export function seededRandom(seedStr) {
  let h = 1779033703 ^ seedStr.length
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

export function todayISO() {
  return new Date().toISOString()
}
