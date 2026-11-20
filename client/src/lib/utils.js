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

// Stable pseudo-IP for a given key (used for session tracking displays).
export function stableIp(key) {
  let h = 0
  const s = String(key || 'x')
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  const a = 10 + (h % 240)
  const b = (h >> 4) % 256
  const c = (h >> 12) % 256
  const d = 20 + ((h >> 20) % 230)
  return `${a}.${b}.${c}.${d}`
}

// ---------- file types ----------
const TYPE_BY_EXT = {
  pdf: 'pdf', png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image',
  doc: 'word', docx: 'word', xls: 'excel', xlsx: 'excel', csv: 'excel',
  txt: 'text', md: 'text', log: 'text', json: 'text'
}

export function fileKind(nameOrType) {
  if (!nameOrType) return 'other'
  const s = String(nameOrType).toLowerCase()
  const ext = s.includes('.') ? s.split('.').pop() : ''
  if (TYPE_BY_EXT[ext]) return TYPE_BY_EXT[ext]
  if (s.startsWith('image/')) return 'image'
  if (s.includes('pdf')) return 'pdf'
  if (s.includes('word') || s.includes('document')) return 'word'
  if (s.includes('sheet') || s.includes('excel') || s.includes('csv')) return 'excel'
  if (s.startsWith('text/')) return 'text'
  return 'other'
}

export function fileIcon(kind) {
  return { pdf: 'PDF', image: 'IMG', word: 'DOC', excel: 'XLS', text: 'TXT', other: 'FILE' }[kind] || 'FILE'
}

export function extOf(name) {
  const s = String(name || '')
  return s.includes('.') ? s.split('.').pop().toLowerCase() : ''
}

// ---------- minimal PDF generator (real, openable one-page PDFs) ----------
function pdfEscapeText(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

export function makePdf(title, lines, meta = '') {
  const body = []
  const wrap = (text, max) => {
    const words = String(text || '').split(/\s+/)
    const rows = []
    let cur = ''
    words.forEach((w) => {
      if ((cur + ' ' + w).trim().length > max) { rows.push(cur.trim()); cur = w } else cur += ' ' + w
    })
    if (cur.trim()) rows.push(cur.trim())
    return rows.length ? rows : ['']
  }
  body.push(['BT', '/F2 16 Tf', '72 760 Td', `(${pdfEscapeText(title)}) Tj`, 'ET'].join('\n'))
  if (meta) body.push(['BT', '/F1 9 Tf', '0.45 0.45 0.45 rg', '72 744 Td', `(${pdfEscapeText(meta)}) Tj`, 'ET'].join('\n'))
  let y = 720
  body.push(['BT', '/F1 10 Tf', '0.12 0.12 0.16 rg'].join('\n'))
  lines.forEach((ln) => {
    if (y < 60) return
    if (ln.heading) {
      body.push('ET')
      body.push(['BT', '/F2 12 Tf', `72 ${y} Td`, `(${pdfEscapeText(ln.heading)}) Tj`, 'ET'].join('\n'))
      y -= 18
      body.push('BT')
      body.push('/F1 10 Tf')
    } else {
      wrap(ln.text || String(ln), 92).forEach((row) => {
        body.push(`1 0 0 1 72 ${y} Tm`)
        body.push(`(${pdfEscapeText(row)}) Tj`)
        y -= 14
      })
      y -= 4
    }
  })
  body.push('ET')
  const content = body.join('\n')
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = []
  objs.forEach((o, i) => {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xrefStart = pdf.length
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  offsets.forEach((off) => { pdf += String(off).padStart(10, '0') + ' 00000 n \n' })
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  return new Blob([pdf], { type: 'application/pdf' })
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

// stable pseudo-random from a string seed (used for seeded data derivation)
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
