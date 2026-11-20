// "AI-assisted" features for the demo (FR-025, FR-026, FR-027, FR-075).
// Everything here is a transparent, deterministic rule-based model - no black box,
// which also demonstrates the AI-governance requirement (explainability + human review).
import { clamp, daysBetween } from './utils.js'

// ---------- Department risk scoring (FR-025) ----------
// Weighted factors, 0-100 score. Factors are returned so the UI can explain the score.
export function computeDepartmentRisk(dept, ctx = {}) {
  const { findings = [], observations = [], audits = [] } = ctx
  const deptFindings = findings.filter((f) => f.departmentId === dept.id && f.status !== 'Closed' && f.status !== 'Resolved')
  const deptObs = observations.filter((o) => o.departmentId === dept.id)

  const criticalCount = deptFindings.filter((f) => f.severity === 'Critical').length
  const highCount = deptFindings.filter((f) => f.severity === 'High').length
  const openObs = deptObs.filter((o) => o.status !== 'Resolved').length
  const nonCompliant = deptObs.filter((o) => o.complianceStatus === 'Non-Compliant').length
  const lastAudit = audits
    .filter((a) => a.departmentId === dept.id && (a.status === 'Completed' || a.status === 'Closed'))
    .sort((a, b) => new Date(b.endDate) - new Date(a.endDate))[0]
  const daysSinceAudit = lastAudit ? Math.abs(daysBetween(lastAudit.endDate, new Date())) : 730
  const budgetFactor = clamp(Math.log10(Math.max(dept.annualBudget || 1e6, 1e6)) - 7, 0, 3) / 3 // ₹1 Cr -> 0, ₹1000 Cr -> 1

  const factors = [
    {
      key: 'Unresolved critical findings',
      value: criticalCount,
      detail: `${criticalCount} critical, ${highCount} high severity findings open`,
      points: clamp(criticalCount * 14 + highCount * 6, 0, 40)
    },
    {
      key: 'Open compliance observations',
      value: openObs,
      detail: `${openObs} open, ${nonCompliant} marked non-compliant`,
      points: clamp(openObs * 4 + nonCompliant * 5, 0, 25)
    },
    {
      key: 'Time since last completed audit',
      value: daysSinceAudit > 700 ? '2+ years' : `${Math.round(daysSinceAudit / 30)} months`,
      detail: lastAudit ? `Last audit: ${lastAudit.code}` : 'No completed audit on record',
      points: clamp((daysSinceAudit / 730) * 20, 0, 20)
    },
    {
      key: 'Budget exposure',
      value: dept.annualBudget,
      detail: 'Higher expenditure implies larger audit surface',
      points: budgetFactor * 15
    }
  ]

  const score = Math.round(clamp(factors.reduce((s, f) => s + f.points, 0), 5, 98))
  const rating = score >= 75 ? 'Critical' : score >= 55 ? 'High' : score >= 30 ? 'Moderate' : 'Low'
  return { score, rating, factors }
}

// ---------- Anomaly detection on transactions (FR-027, FR-075) ----------
// Rules: duplicate payments, round-amount transfers, weekend activity,
// split purchases just below approval thresholds, vendor concentration.
export function detectAnomalies(transactions, departmentId) {
  const txns = departmentId ? transactions.filter((t) => t.departmentId === departmentId) : transactions
  const flags = new Map()

  const addFlag = (t, reason, points) => {
    if (!flags.has(t.id)) flags.set(t.id, { txn: t, reasons: [], score: 0 })
    const f = flags.get(t.id)
    if (!f.reasons.includes(reason)) f.reasons.push(reason)
    f.score += points
  }

  // 1. duplicates: same vendor + same amount within 7 days
  const seen = {}
  txns.forEach((t) => {
    const key = `${t.vendor}|${t.amount}`
    if (seen[key]) {
      const gap = Math.abs(daysBetween(seen[key].date, t.date))
      if (gap <= 7) {
        addFlag(t, 'Duplicate payment: same vendor and amount within 7 days', 35)
        addFlag(seen[key], 'Duplicate payment: same vendor and amount within 7 days', 35)
      }
    } else seen[key] = t
  })

  // 2. round amounts >= 10 lakh
  txns.forEach((t) => {
    if (t.amount >= 1000000 && t.amount % 100000 === 0) {
      addFlag(t, 'Round-figure transfer of ₹10 lakh or more', 15)
    }
    // 3. split purchases: 2+ payments of ₹4.5-5.0 lakh to same vendor within 10 days
  })

  const vendorWindow = {}
  txns.forEach((t) => {
    if (t.amount >= 450000 && t.amount < 500000) {
      const k = `${t.vendor}`
      vendorWindow[k] = (vendorWindow[k] || []).concat(t)
    }
  })
  Object.values(vendorWindow).forEach((list) => {
    list.sort((a, b) => new Date(a.date) - new Date(b.date))
    for (let i = 1; i < list.length; i++) {
      if (Math.abs(daysBetween(list[i - 1].date, list[i].date)) <= 10) {
        addFlag(list[i], 'Split purchase pattern just below ₹5 lakh approval threshold', 30)
        addFlag(list[i - 1], 'Split purchase pattern just below ₹5 lakh approval threshold', 30)
      }
    }
  })

  // 4. large weekend payments (routine weekend spend is common, very large transfers are not)
  txns.forEach((t) => {
    const day = new Date(t.date).getDay()
    if ((day === 0 || day === 6) && t.amount >= 5000000) addFlag(t, 'High-value payment (₹50 lakh+) processed on a weekend', 20)
  })

  // 5. vendor concentration (> 40% of department spend, departments spending ₹2 Cr+)
  const deptGroups = {}
  txns.forEach((t) => {
    ;(deptGroups[t.departmentId] = deptGroups[t.departmentId] || { total: 0, vendors: {} })
    deptGroups[t.departmentId].total += t.amount
    deptGroups[t.departmentId].vendors[t.vendor] = (deptGroups[t.departmentId].vendors[t.vendor] || 0) + t.amount
  })
  Object.values(deptGroups).forEach((g) => {
    Object.entries(g.vendors).forEach(([vendor, amt]) => {
      if (amt / g.total > 0.4 && g.total >= 20000000) {
        txns.filter((t) => t.vendor === vendor).forEach((t) =>
          addFlag(t, `Vendor concentration: ${vendor} receives ${Math.round((amt / g.total) * 100)}% of department spend`, 10)
        )
      }
    })
  })

  return Array.from(flags.values())
    .map((f) => ({ ...f, score: clamp(f.score, 0, 100), humanReview: f.reviewStatus || 'Pending review' }))
    .sort((a, b) => b.score - a.score)
}

// ---------- Predictive compliance trend (FR-026) ----------
// Simple linear regression over monthly compliance rates, projected 3 months ahead.
export function projectCompliance(monthlyRates, monthsAhead = 3) {
  const pts = monthlyRates.map((r, i) => ({ x: i, y: r }))
  const n = pts.length
  if (n < 2) return { projected: monthlyRates.slice(), slope: 0 }
  const mx = pts.reduce((s, p) => s + p.x, 0) / n
  const my = pts.reduce((s, p) => s + p.y, 0) / n
  let num = 0
  let den = 0
  pts.forEach((p) => {
    num += (p.x - mx) * (p.y - my)
    den += (p.x - mx) * (p.x - mx)
  })
  const slope = den === 0 ? 0 : num / den
  const intercept = my - slope * mx
  const projected = []
  for (let i = n; i < n + monthsAhead; i++) {
    projected.push(clamp(intercept + slope * i, 0, 100))
  }
  return { projected, slope }
}

// ---------- Audit progress suggestion (simple heuristic) ----------
export function suggestedProgress(audit) {
  if (!audit.checklist || !audit.checklist.length) return audit.progress || 0
  const done = audit.checklist.filter((c) => c.status === 'Completed' || c.status === 'N/A').length
  return Math.round((done / audit.checklist.length) * 100)
}
