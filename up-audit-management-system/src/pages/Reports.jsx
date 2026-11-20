// Reports (FR-040 to FR-044): templates, automated report generation from
// audit data, draft → review → approval workflow, and export to PDF / Word /
// Excel. Executive dashboards live in Dashboard and Analytics.
import { useMemo, useState } from 'react'
import { useData } from '../context/DataContext'
import { Badge, Empty, Modal, StatCard, Tabs } from '../components/ui'
import { Link } from '../lib/router'
import { fmtDate, todayISO, uid, fmtINR, fmtINRCompact, daysFromNow } from '../lib/utils'
import { can } from '../lib/permissions'
import { exportCSV, exportWord, printDocument, tableHTML } from '../lib/exporters'
import config from '../lib/config'

export default function Reports() {
  const { data, currentUser, save, toast, notify, logActivity } = useData()
  const [tab, setTab] = useState('library')
  const [genOpen, setGenOpen] = useState(false)
  const [preview, setPreview] = useState(null)

  const canCreate = can(currentUser, 'report.create')
  const canApprove = can(currentUser, 'report.approve')
  const isCoord = currentUser.role === 'coordinator'
  const reports = isCoord ? data.reports.filter((r) => r.departmentId === currentUser.departmentId) : data.reports

  const draftCount = reports.filter((r) => r.status === 'Draft').length
  const inReview = reports.filter((r) => r.status === 'In Review').length
  const finalCount = reports.filter((r) => r.status === 'Final').length

  // build report content sections from actual audit data
  const buildSections = (template, audit) => {
    const findings = audit ? data.findings.filter((f) => f.auditId === audit.id) : []
    const obs = audit ? data.observations.filter((o) => o.auditId === audit.id) : []
    const dept = audit ? (data.departments.find((d) => d.id === audit.departmentId) || {}) : {}
    const base = [
      ['Header & Audit Reference', `Audit code: ${audit ? audit.code : '—'}\nTitle: ${audit ? audit.title : template.name}\nDepartment: ${audit ? audit.departmentName : 'All departments'}\nAudit period: ${audit ? audit.auditPeriod : config.fiscalYear}\nTeam: ${audit ? (audit.leadAuditorName || 'unassigned') + (audit.team.length ? ', ' + audit.team.map((t) => t.name).join(', ') : '') : '—'}`],
      ['Objectives & Scope', `${audit ? audit.objectives : 'Consolidated review of audit findings and compliance position for the year.'}\n\nScope: ${audit ? audit.scope : 'All departments and audit types.'}`]
    ]
    if (template.type === 'Detailed') {
      base.push(
        ['Methodology', `Risk-based sampling with vouching and cross-verification against treasury records. Checklist coverage: ${audit ? audit.checklist.length : 0} items, ${audit ? audit.checklist.filter((c) => c.status === 'Completed' || c.status === 'N/A').length : 0} completed. Evidence references: ${audit ? audit.evidence.length : 0} items in the evidence store.`],
        ['Findings & Analysis', findings.length
          ? findings.map((f) => `${f.severity.toUpperCase()} — ${f.title}\n${f.description}${f.amountInvolved ? `\nAmount involved: ${fmtINR(f.amountInvolved)}` : ''}`).join('\n\n')
          : 'No findings recorded for this audit.'],
        ['Department Responses', findings.some((f) => f.responses.length)
          ? findings.filter((f) => f.responses.length).map((f) => `${f.title}:\n${f.responses.map((r) => `  • ${r.by}: ${r.text}`).join('\n')}`).join('\n\n')
          : 'No department responses received yet.'],
        ['Recommendations', findings.length
          ? findings.map((f, i) => `${i + 1}. ${f.severity === 'Critical' || f.severity === 'High' ? 'Immediate' : 'Time-bound'} corrective action on: ${f.title.toLowerCase()}`).join('\n')
          : 'Continue monitoring through routine audits.'],
        ['Annexure: Checklist Status', audit
          ? tableHTML(['#', 'Checklist item', 'Status'], audit.checklist.map((c, i) => [i + 1, c.item, c.status]))
          : '']
      )
    }
    if (template.type === 'Compliance') {
      base.push(
        ['Compliance Summary', `Open observations: ${obs.filter((o) => o.status !== 'Resolved').length} of ${obs.length}. Compliance rate: ${obs.length ? Math.round((obs.filter((o) => o.status === 'Resolved').length / obs.length) * 100) : 100}%.`],
        ['Observation-wise Status', tableHTML(['Observation', 'Requirement', 'Compliance', 'Due'], obs.map((o) => [o.title, o.requirement, o.complianceStatus, fmtDate(o.dueDate)]))],
        ['Ageing Analysis', tableHTML(['Ageing', 'Count'], [['Overdue', obs.filter((o) => o.status !== 'Resolved' && daysFromNow(o.dueDate) < 0).length], ['Due within 30 days', obs.filter((o) => o.status !== 'Resolved' && daysFromNow(o.dueDate) >= 0 && daysFromNow(o.dueDate) <= 30).length], ['Resolved', obs.filter((o) => o.status === 'Resolved').length]])],
        ['Escalations', obs.filter((o) => o.escalationLevel > 0).length ? tableHTML(['Observation', 'Level'], obs.filter((o) => o.escalationLevel > 0).map((o) => [o.title, 'L' + o.escalationLevel])) : 'No escalations active.']
      )
    }
    if (template.type === 'Executive') {
      base.push(
        ['Key Findings Summary', findings.length ? findings.slice(0, 5).map((f) => `• [${f.severity}] ${f.title}`).join('\n') : 'No findings.'],
        ['Risk Rating', `${audit ? audit.departmentName : 'Portfolio'} — composite risk score ${audit ? audit.riskScore : '—'}/100 at planning stage.`],
        ['Recommendations', 'Prioritise resolution of critical findings; enforce time-bound compliance tracking with escalation.']
      )
    }
    if (template.type === 'Performance') {
      base.push(
        ['Benchmark Scores', tableHTML(['Department', 'Compliance %'], data.departments.slice(0, 8).map((d) => {
          const ob = data.observations.filter((o) => o.departmentId === d.id)
          return [d.name, ob.length ? Math.round((ob.filter((o) => o.status === 'Resolved').length / ob.length) * 100) : 100]
        }))],
        ['Risk Ratings', tableHTML(['Department', 'Open findings'], data.departments.map((d) => [d.name, data.findings.filter((f) => f.departmentId === d.id && !['Resolved', 'Closed'].includes(f.status)).length]).filter((r) => r[1] > 0))],
        ['Recommended Audit Plan', 'Risk-based selection for the next quarter as per the Analytics module ranking.']
      )
    }
    return base
  }

  const generate = async (form) => {
    const template = data.templates.find((t) => t.id === form.templateId)
    const audit = form.auditId ? data.audits.find((a) => a.id === form.auditId) : null
    const dept = audit ? { departmentId: audit.departmentId, departmentName: audit.departmentName } : { departmentId: null }
    const report = {
      id: uid('r'),
      title: form.title || (audit ? `${template.name} — ${audit.code} ${audit.departmentName}` : template.name),
      templateId: template.id,
      templateName: template.name,
      auditId: audit ? audit.id : null,
      departmentId: dept.departmentId,
      status: 'Draft',
      generatedBy: currentUser.id,
      generatedByName: currentUser.name,
      generatedAt: todayISO(),
      approvedBy: null,
      approvedAt: null,
      version: 1,
      summary: audit
        ? `Auto-generated from audit data: ${audit.checklist.length} checklist items, ${data.findings.filter((f) => f.auditId === audit.id).length} findings, ${audit.evidence.length} evidence items.`
        : 'Auto-generated consolidated report.',
      sections: buildSections(template, audit)
    }
    await save('reports', report, { logAction: 'Generated report', logDetail: report.title })
    toast('Report generated from audit data — saved as draft.')
    setGenOpen(false)
    setPreview(report)
  }

  const setStatus = async (r, status) => {
    const patch = { status }
    if (status === 'Approved') { patch.approvedBy = `${currentUser.name} (${currentUser.role === 'director' ? 'Director' : 'CAO'})`; patch.approvedAt = todayISO() }
    if (status === 'Final') { patch.approvedBy = patch.approvedBy || r.approvedBy || `${currentUser.name} (Director)`; patch.approvedAt = patch.approvedAt || todayISO() }
    await save('reports', { ...r, ...patch }, { logAction: `Report ${status.toLowerCase()}`, logDetail: r.title })
    if (status === 'In Review') await notify('u_cao', 'Review', `Report awaiting review: ${r.title}`, `Submitted by ${currentUser.name}.`, '/reports')
    if (status === 'Final') {
      const coord = data.users.find((u) => u.role === 'coordinator' && u.departmentId === r.departmentId)
      if (coord) await notify(coord.id, 'System', `Final report issued: ${r.title}`, 'The final audit report has been issued to your department.', '/reports')
    }
    toast(`Report moved to “${status}”.`)
  }

  const exportReportCSV = (r) => {
    const audit = data.audits.find((a) => a.id === r.auditId)
    const findings = audit ? data.findings.filter((f) => f.auditId === audit.id) : data.findings
    exportCSV(r.title.replace(/[^\w -]/g, ''), findings.map((f) => ({
      Audit: f.auditCode, Finding: f.title, Severity: f.severity, Status: f.status,
      'Amount (₹)': f.amountInvolved || 0, Raised: fmtDate(f.raisedDate), Due: fmtDate(f.dueDate)
    })))
    toast('Findings table exported (Excel/CSV).')
  }

  const reportHTML = (r) => {
    const html = r.sections.map(([h, body]) => `<h2>${h}</h2><div>${(body || '').split('\n').map((l) => (l.trim() ? `<p>${l}</p>` : '')).join('')}</div>`).join('')
    return `<h1>${r.title}</h1>
      <div class="meta">${config.orgName} · ${config.appName} · Status: ${r.status} · Generated ${fmtDate(r.generatedAt)} by ${r.generatedByName}${r.approvedBy ? ` · Approved by ${r.approvedBy}` : ''}</div>${html}`
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Reports</h1>
          <div className="sub">Automated report generation with templates, review workflow and PDF / Word / Excel export (FR-040 to FR-044).</div>
        </div>
        {canCreate && <div className="page-actions"><button className="btn btn-primary" onClick={() => setGenOpen(true)}>+ Generate report</button></div>}
      </div>

      <div className="stat-grid">
        <StatCard label="Reports in library" value={reports.length} icon="▥" accent />
        <StatCard label="Drafts" value={draftCount} icon="✎" />
        <StatCard label="In review" value={inReview} icon="◎" />
        <StatCard label="Final / issued" value={finalCount} icon="✓" />
      </div>

      <Tabs
        tabs={[
          { key: 'library', label: 'Report Library', count: reports.length },
          { key: 'templates', label: 'Templates', count: data.templates.length }
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'library' && (
        <div className="card">
          <div className="table-wrap">
            {reports.length === 0 ? (
              <div className="card-body"><Empty icon="▥" title="No reports yet" sub={canCreate ? 'Generate one from a template.' : 'Reports created by the audit team will appear here.'} /></div>
            ) : (
              <table className="tbl">
                <thead><tr><th>Report</th><th>Template</th><th>Status</th><th>Generated by</th><th>Approved by</th><th style={{ minWidth: 200 }}></th></tr></thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id}>
                      <td className="strong" style={{ maxWidth: 320 }}>{r.title}<div className="sub">{fmtDate(r.generatedAt)} · v{r.version}</div></td>
                      <td className="small">{r.templateName}</td>
                      <td><Badge kind={r.status}>{r.status}</Badge></td>
                      <td className="small">{r.generatedByName}</td>
                      <td className="small">{r.approvedBy || '—'}</td>
                      <td className="right">
                        <div className="flex" style={{ gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => setPreview(r)}>View</button>
                          {r.status === 'Draft' && canCreate && <button className="btn btn-primary btn-sm" onClick={() => setStatus(r, 'In Review')}>Submit for review</button>}
                          {r.status === 'In Review' && canApprove && <button className="btn btn-primary btn-sm" onClick={() => setStatus(r, 'Approved')}>Approve</button>}
                          {r.status === 'Approved' && canApprove && <button className="btn btn-primary btn-sm" onClick={() => setStatus(r, 'Final')}>Mark final & issue</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'templates' && (
        <div className="grid-2">
          {data.templates.map((t) => (
            <div className="card" key={t.id}>
              <div className="card-head"><h3>{t.name}</h3><Badge kind="Low">{t.type}</Badge></div>
              <div className="card-body">
                <p className="small muted">{t.description}</p>
                <b className="small">Sections</b>
                <ul className="small muted" style={{ marginTop: 4 }}>
                  {t.sections.map((s) => <li key={s}>{s}</li>)}
                </ul>
                {canCreate && <button className="btn btn-secondary btn-sm" onClick={() => setGenOpen({ templateId: t.id })}>Use this template →</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* generate modal */}
      <GenerateModal
        open={!!genOpen}
        initial={typeof genOpen === 'object' ? genOpen : null}
        onClose={() => setGenOpen(false)}
        templates={data.templates}
        audits={data.audits.filter((a) => !['Planned', 'Scheduled'].includes(a.status))}
        onGenerate={generate}
      />

      {/* preview modal */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview ? preview.title : ''} size="xl"
        footer={preview ? (
          <>
            <button className="btn btn-secondary" onClick={() => printDocument(preview.title, reportHTML(preview))}>⎙ PDF</button>
            <button className="btn btn-secondary" onClick={() => exportWord(preview.title.replace(/[^\w -]/g, ''), preview.title, reportHTML(preview))}>⤓ Word</button>
            <button className="btn btn-secondary" onClick={() => exportReportCSV(preview)}>⤓ Excel (findings)</button>
            <button className="btn btn-primary" onClick={() => setPreview(null)}>Close</button>
          </>
        ) : null}>
        {preview && (
          <div style={{ fontSize: 13.5 }}>
            <div className="flex wrap mb-2" style={{ gap: 8 }}>
              <Badge kind={preview.status}>{preview.status}</Badge>
              <span className="tag">{preview.templateName}</span>
              <span className="tag">v{preview.version}</span>
            </div>
            <p className="muted small">{preview.summary}</p>
            {preview.sections.map(([h, body], i) => (
              <div key={i} style={{ marginTop: 14 }}>
                <h4 style={{ fontSize: 14, borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>{h}</h4>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, marginTop: 6 }}>{body}</div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}

function GenerateModal({ open, initial, onClose, templates, audits, onGenerate }) {
  const [form, setForm] = useState({ templateId: '', auditId: '', title: '' })
  const eff = { templateId: form.templateId || (initial && initial.templateId) || (templates[0] || {}).id, auditId: form.auditId, title: form.title }
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  return (
    <Modal open={open} onClose={onClose} title="Generate report"
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={() => onGenerate(eff)}>Generate draft report</button></>}>
      <div className="field"><label>Template</label>
        <select className="select" value={eff.templateId} onChange={(e) => set('templateId', e.target.value)}>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select></div>
      <div className="field"><label>Audit (leave blank for consolidated)</label>
        <select className="select" value={eff.auditId} onChange={(e) => set('auditId', e.target.value)}>
          <option value="">— Consolidated (all data) —</option>
          {audits.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.title.slice(0, 60)}</option>)}
        </select></div>
      <div className="field"><label>Custom title (optional)</label>
        <input className="input" value={eff.title} onChange={(e) => set('title', e.target.value)} placeholder="Auto-generated if left blank" /></div>
      <div className="callout">The report content is generated automatically from the selected audit's data — checklist status, findings, department responses and compliance observations.</div>
    </Modal>
  )
}
