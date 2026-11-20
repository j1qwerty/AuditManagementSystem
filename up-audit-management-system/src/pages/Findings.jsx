// Findings registry (FR-032) — global view with severity KPIs, filters,
// department responses and resolution workflow. Export to Excel/PDF.
import { useMemo, useState } from 'react'
import { useData } from '../context/DataContext'
import { Badge, Empty, Modal, SeverityBadge, StatCard, Pagination } from '../components/ui'
import { Link } from '../lib/router'
import { fmtDate, fmtINR, fmtINRCompact, daysFromNow, todayISO, groupBy } from '../lib/utils'
import { can } from '../lib/permissions'
import { exportCSV, printDocument, tableHTML } from '../lib/exporters'
import config from '../lib/config'

export default function Findings() {
  const { data, currentUser, save, toast, sendEmail } = useData()
  const [q, setQ] = useState('')
  const [fSev, setFSev] = useState('All')
  const [fStatus, setFStatus] = useState('All')
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState(null)
  const [response, setResponse] = useState('')
  const pageSize = config.pageSize

  const isCoordinator = currentUser.role === 'coordinator'
  const scoped = isCoordinator
    ? data.findings.filter((f) => f.departmentId === currentUser.departmentId)
    : data.findings

  const rows = useMemo(
    () =>
      scoped
        .filter((f) => (fSev === 'All' ? true : f.severity === fSev))
        .filter((f) => (fStatus === 'All' ? true : f.status === fStatus))
        .filter((f) => (f.title + f.auditCode + (f.category || '')).toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => new Date(b.raisedDate) - new Date(a.raisedDate)),
    [scoped, fSev, fStatus, q]
  )

  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const curPage = Math.min(page, pages)
  const paged = rows.slice((curPage - 1) * pageSize, curPage * pageSize)

  const open = scoped.filter((f) => !['Resolved', 'Closed'].includes(f.status))
  const overdue = open.filter((f) => daysFromNow(f.dueDate) < 0)
  const exposure = open.reduce((s, f) => s + (f.amountInvolved || 0), 0)

  const byCategory = groupBy(open, (f) => f.category || 'Other')

  const respond = async () => {
    if (!response.trim() || !detail) return
    const rec = {
      ...detail,
      responses: [...detail.responses, { by: `${currentUser.name} (Department Coordinator)`, role: 'coordinator', type: 'Response', text: response, date: todayISO() }],
      status: detail.status === 'Open' ? 'Under Review' : detail.status
    }
    await save('findings', rec, { logAction: 'Responded to finding', logDetail: detail.title })
    await sendEmail(currentUser.email, `Response recorded: ${detail.title}`, 'Your response has been shared with the audit team.')
    setDetail(rec)
    setResponse('')
    toast('Response recorded.')
  }

  const setStatus = async (f, status) => {
    await save('findings', { ...f, status }, { logAction: 'Updated finding status', logDetail: `${f.title} → ${status}` })
    toast(`Finding marked ${status}.`)
    setDetail(null)
  }

  const doExportCSV = () => {
    exportCSV('findings-registry', rows.map((f) => ({
      Audit: f.auditCode, Title: f.title, Category: f.category, Severity: f.severity,
      Status: f.status, 'Amount (₹)': f.amountInvolved || 0, Raised: fmtDate(f.raisedDate),
      'Due date': fmtDate(f.dueDate), 'Raised by': f.raisedByName
    })))
    toast('Findings exported (Excel/CSV).')
  }

  const doExportPDF = () => {
    printDocument(
      'Findings Registry',
      `<h1>Findings Registry</h1>
      <div class="meta">${config.orgName} · ${config.appName} · generated ${fmtDate(todayISO())} · ${rows.length} findings</div>
      ${tableHTML(
        ['Audit', 'Finding', 'Severity', 'Status', 'Amount', 'Due'],
        rows.map((f) => [f.auditCode, f.title, f.severity, f.status, f.amountInvolved ? fmtINR(f.amountInvolved) : '—', fmtDate(f.dueDate)])
      )}`
    )
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Findings Registry</h1>
          <div className="sub">{isCoordinator ? 'Findings raised against your department — record responses and track resolution.' : 'All audit findings across departments with severity, ageing and resolution status.'}</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={doExportCSV}>⤓ Excel</button>
          <button className="btn btn-secondary" onClick={doExportPDF}>⎙ PDF</button>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Open findings" value={open.length} icon="!" accent />
        <StatCard label="Critical / High" value={open.filter((f) => ['Critical', 'High'].includes(f.severity)).length} icon="⚠" />
        <StatCard label="Overdue responses" value={overdue.length} icon="⏱" delta={{ text: 'past due date', dir: overdue.length ? 'down' : 'up' }} />
        <StatCard label="Financial exposure" value={fmtINRCompact(exposure)} icon="₹" />
      </div>

      <div className="filter-bar">
        <input className="input search" placeholder="Search finding, audit code…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        <select className="select" value={fSev} onChange={(e) => setFSev(e.target.value)}>
          <option>All</option>{['Critical', 'High', 'Medium', 'Low'].map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="select" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option>All</option>{['Open', 'Under Review', 'Action Planned', 'Resolved', 'Closed'].map((s) => <option key={s}>{s}</option>)}
        </select>
        <span className="muted small">{rows.length} findings</span>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Audit</th><th>Finding</th><th>Category</th><th>Severity</th><th className="num">Amount</th><th>Status</th><th>Due</th></tr>
            </thead>
            <tbody>
              {paged.map((f) => {
                const od = !['Resolved', 'Closed'].includes(f.status) && daysFromNow(f.dueDate) < 0
                return (
                  <tr key={f.id} className="clickable" onClick={() => setDetail(f)}>
                    <td className="strong">{f.auditCode}</td>
                    <td style={{ maxWidth: 400 }}>{f.title.length > 66 ? f.title.slice(0, 66) + '…' : f.title}</td>
                    <td className="small">{f.category}</td>
                    <td><SeverityBadge s={f.severity} /></td>
                    <td className="num small">{f.amountInvolved ? fmtINRCompact(f.amountInvolved) : '—'}</td>
                    <td><Badge kind={f.status}>{f.status}</Badge></td>
                    <td className="small">{fmtDate(f.dueDate)}{od && <div className="sub" style={{ color: 'var(--danger)' }}>overdue</div>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <Empty icon="✓" title="No findings match" sub="Adjust filters to see more." />}
        <div style={{ padding: '0 14px 12px' }}>
          <Pagination page={curPage} pages={pages} onPage={setPage} total={rows.length} pageSize={pageSize} />
        </div>
      </div>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? detail.title : ''} size="lg">
        {detail && (
          <div>
            <div className="flex wrap mb-2" style={{ gap: 8 }}>
              <SeverityBadge s={detail.severity} /><Badge kind={detail.status}>{detail.status}</Badge>
              <span className="tag">{detail.category}</span>
              <Link to={`/audit/${detail.auditId}`} className="tag" style={{ background: 'var(--info-soft)' }}>{detail.auditCode}</Link>
              {detail.amountInvolved ? <span className="tag">{fmtINR(detail.amountInvolved)}</span> : null}
            </div>
            <p style={{ lineHeight: 1.55 }}>{detail.description}</p>
            <div className="muted small">
              Raised by {detail.raisedByName} on {fmtDate(detail.raisedDate)} · response due {fmtDate(detail.dueDate)}
            </div>
            <hr className="divider" />
            <b style={{ fontSize: 13 }}>Responses & action taken</b>
            {detail.responses.length === 0 && <div className="muted small mt-1">No response recorded yet.</div>}
            {detail.responses.map((r, i) => (
              <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', margin: '7px 0' }}>
                <div className="small" style={{ fontWeight: 600 }}>{r.by}</div>
                <div className="small muted">{fmtDate(r.date)}</div>
                <div className="small" style={{ marginTop: 4 }}>{r.text}</div>
              </div>
            ))}
            {isCoordinator && !['Resolved', 'Closed'].includes(detail.status) && (
              <div className="mt-2">
                <div className="field"><label>Department response</label>
                  <textarea className="textarea" value={response} onChange={(e) => setResponse(e.target.value)} /></div>
                <button className="btn btn-primary" onClick={respond}>Send response</button>
              </div>
            )}
            {can(currentUser, 'finding.close') && !['Resolved', 'Closed'].includes(detail.status) && (
              <div className="flex mt-2" style={{ gap: 8 }}>
                <button className="btn btn-secondary" onClick={() => setStatus(detail, 'Action Planned')}>Action planned</button>
                <button className="btn btn-secondary" onClick={() => setStatus(detail, 'Resolved')}>Mark resolved</button>
                <button className="btn btn-secondary" onClick={() => setStatus(detail, 'Closed')}>Close</button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
