// Department registry (FR-010 to FR-013): list, search, filter + detail view
// with org structure mapping, contacts, department documents and audit history.
import { useMemo, useState } from 'react'
import { useData } from '../context/DataContext'
import { Link } from '../lib/router'
import { Badge, Empty, StatCard, TypeBadge, Progress, PROGRESS_CLASS } from '../components/ui'
import { fmtINRCompact, fmtDate } from '../lib/utils'
import { computeDepartmentRisk } from '../lib/ai'

const RISK_CLASS = { Critical: 'danger', High: 'danger', Moderate: 'warning', Low: 'success' }

export default function Departments() {
  const { data } = useData()
  const [q, setQ] = useState('')
  const [riskFilter, setRiskFilter] = useState('All')

  const rows = useMemo(() => {
    return data.departments
      .map((d) => {
        const risk = computeDepartmentRisk(d, { findings: data.findings, observations: data.observations, audits: data.audits })
        const audits = data.audits.filter((a) => a.departmentId === d.id)
        const openFindings = data.findings.filter((f) => f.departmentId === d.id && !['Resolved', 'Closed'].includes(f.status)).length
        const openObs = data.observations.filter((o) => o.departmentId === d.id && o.status !== 'Resolved').length
        return { d, risk, audits: audits.length, openFindings, openObs }
      })
      .filter((r) => r.d.name.toLowerCase().includes(q.toLowerCase()))
      .filter((r) => riskFilter === 'All' || r.risk.rating === riskFilter)
      .sort((a, b) => b.risk.score - a.risk.score)
  }, [data, q, riskFilter])

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Departments</h1>
          <div className="sub">Registry of government departments with risk rating, audit coverage and open compliance items (FR-010 to FR-013).</div>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Departments registered" value={data.departments.length} icon="⌂" accent />
        <StatCard label="High / critical risk" value={rows.filter((r) => ['High', 'Critical'].includes(r.risk.rating)).length} icon="⚠" />
        <StatCard label="Open findings (all depts)" value={rows.reduce((s, r) => s + r.openFindings, 0)} icon="!" />
        <StatCard label="Open observations" value={rows.reduce((s, r) => s + r.openObs, 0)} icon="✓" />
      </div>

      <div className="filter-bar">
        <input className="input search" placeholder="Search department…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select" value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
          {['All', 'Critical', 'High', 'Moderate', 'Low'].map((r) => <option key={r}>{r}</option>)}
        </select>
        <span className="muted small">{rows.length} shown · sorted by risk score</span>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Department</th><th>Head</th><th className="num">Annual budget</th>
                <th className="num">Audits</th><th className="num">Open findings</th><th className="num">Open obs.</th>
                <th>Risk rating</th><th className="num">Risk score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ d, risk, audits, openFindings, openObs }) => (
                <tr key={d.id} className="clickable" onClick={() => (window.location.hash = `#/department/${d.id}`)}>
                  <td>
                    <div className="strong">{d.name}</div>
                    <div className="sub">{d.code} · {d.units.length} units · {d.employeeCount.toLocaleString('en-IN')} staff</div>
                  </td>
                  <td>
                    <div>{d.headName}</div>
                    <div className="sub">{d.headDesignation}</div>
                  </td>
                  <td className="num">{fmtINRCompact(d.annualBudget)}</td>
                  <td className="num">{audits}</td>
                  <td className="num">{openFindings || '—'}</td>
                  <td className="num">{openObs || '—'}</td>
                  <td><Badge kind={risk.rating === 'Moderate' ? 'Medium' : risk.rating}>{risk.rating}</Badge></td>
                  <td className="num"><b>{risk.score}</b><div className="sub">/100</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <Empty icon="⌂" title="No departments match" sub="Adjust the search or filter." />}
      </div>
    </div>
  )
}

export function DepartmentDetail({ id }) {
  const { data } = useData()
  const d = data.departments.find((x) => x.id === id)
  if (!d) return <Empty icon="⌂" title="Department not found" sub="It may have been removed." />

  const audits = data.audits.filter((a) => a.departmentId === d.id)
  const findings = data.findings.filter((f) => f.departmentId === d.id)
  const obs = data.observations.filter((o) => o.departmentId === d.id)
  const docs = data.documents.filter((doc) => doc.departmentId === d.id)
  const risk = computeDepartmentRisk(d, { findings: data.findings, observations: data.observations, audits: data.audits })
  const resolvedObs = obs.filter((o) => o.status === 'Resolved').length

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{d.name}</h1>
          <div className="sub">{d.code} · {d.headDesignation} — {d.headName} · Established {d.established}</div>
        </div>
        <div className="page-actions">
          <Badge kind={risk.rating === 'Moderate' ? 'Medium' : risk.rating}>Risk: {risk.rating} ({risk.score}/100)</Badge>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Annual budget" value={fmtINRCompact(d.annualBudget)} icon="₹" />
        <StatCard label="Audits on record" value={audits.length} icon="☰" />
        <StatCard label="Open findings" value={findings.filter((f) => !['Resolved', 'Closed'].includes(f.status)).length} icon="!" />
        <StatCard label="Compliance rate" value={`${obs.length ? Math.round((resolvedObs / obs.length) * 100) : 100}%`} icon="✓" delta={{ text: `${obs.length - resolvedObs} open observations`, dir: obs.length - resolvedObs ? 'down' : 'up' }} />
      </div>

      <div className="grid-2 mb-3">
        <div className="card">
          <div className="card-head"><h3>Organisational structure</h3><span className="hint">FR-011 mapping</span></div>
          <div className="card-body">
            <div className="flex" style={{ justifyContent: 'flex-start', marginBottom: 10 }}>
              <span style={{ background: 'var(--primary-soft)', border: '1px solid var(--primary-border)', borderRadius: 6, padding: '6px 12px', fontWeight: 700, fontSize: 13 }}>{d.name}</span>
            </div>
            <ul className="timeline">
              {d.units.map((u) => (
                <li key={u.id}>
                  <div className="tt"><b>{u.name}</b></div>
                  <div className="td">{u.head} · {u.staffCount.toLocaleString('en-IN')} staff</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>Contact & profile</h3><span className="hint">FR-012</span></div>
          <div className="card-body">
            <dl className="kv">
              <dt>Head of department</dt><dd>{d.headName} ({d.headDesignation})</dd>
              <dt>Office email</dt><dd>{d.contactEmail}</dd>
              <dt>Phone</dt><dd>{d.contactPhone}</dd>
              <dt>Address</dt><dd>{d.address}, {d.city}</dd>
              <dt>Annual budget</dt><dd>{fmtINRCompact(d.annualBudget)}</dd>
              <dt>Sanctioned staff</dt><dd>{d.employeeCount.toLocaleString('en-IN')}</dd>
            </dl>
            <hr className="divider" />
            <SectionMini title="AI risk score — factor breakdown" hint="explainable, rule-based">
              {risk.factors.map((f) => (
                <div key={f.key} className="flex-between small" style={{ padding: '3px 0' }}>
                  <span>{f.key}</span>
                  <span className="muted">+{Math.round(f.points)} pts</span>
                </div>
              ))}
              <div className="flex-between small" style={{ fontWeight: 700, borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 6 }}>
                <span>Total</span><span>{risk.score}/100 — {risk.rating}</span>
              </div>
            </SectionMini>
          </div>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-head"><h3>Audit history</h3><span className="hint">{audits.length} audits</span></div>
        <div className="table-wrap">
          {audits.length === 0 ? (
            <div className="card-body"><Empty icon="☰" title="No audits yet" /></div>
          ) : (
            <table className="tbl">
              <thead><tr><th>Code</th><th>Title</th><th>Type</th><th>Status</th><th>Lead</th><th>Period</th><th className="num">Progress</th></tr></thead>
              <tbody>
                {audits.map((a) => (
                  <tr key={a.id} className="clickable" onClick={() => (window.location.hash = `#/audit/${a.id}`)}>
                    <td className="strong">{a.code}</td>
                    <td>{a.title.length > 56 ? a.title.slice(0, 56) + '…' : a.title}</td>
                    <td><TypeBadge t={a.type} /></td>
                    <td><Badge kind={a.status}>{a.status}</Badge></td>
                    <td>{a.leadAuditorName || '—'}</td>
                    <td className="small">{fmtDate(a.startDate)} – {fmtDate(a.endDate)}</td>
                    <td className="num" style={{ minWidth: 110 }}>
                      <Progress value={a.progress} className={PROGRESS_CLASS(a.progress)} />
                      <span className="muted small">{a.progress}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><h3>Department documents</h3><Link to="/documents" className="small">Repository →</Link></div>
          <div className="card-body">
            {docs.length === 0 && <Empty icon="▤" title="No department documents" sub="Coordinators can upload records to the repository." />}
            {docs.map((doc) => (
              <div key={doc.id} className="flex-between" style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{doc.name}</div>
                  <div className="muted small">{doc.category} · v{doc.versions.length} · by {doc.ownerName}</div>
                </div>
                <Badge kind="Active">{doc.category}</Badge>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>Recent findings</h3><Link to="/findings" className="small">Registry →</Link></div>
          <div className="card-body">
            {findings.length === 0 && <Empty icon="✓" title="No findings recorded" />}
            {findings.slice(0, 6).map((f) => (
              <div key={f.id} className="flex-between" style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, maxWidth: 420 }}>{f.title}</div>
                  <div className="muted small">{f.auditCode} · {fmtDate(f.raisedDate)}</div>
                </div>
                <Badge kind={f.status}>{f.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionMini({ title, hint, children }) {
  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 6 }}>
        <b style={{ fontSize: 13 }}>{title}</b>
        {hint && <span className="muted small">{hint}</span>}
      </div>
      {children}
    </div>
  )
}
