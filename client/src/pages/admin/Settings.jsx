// Settings - workspace preferences, notifications, data backup/restore and a
// developer section (integration + environment) as the last tab.
import { useMemo, useState, useEffect } from 'react'
import { useData } from '../../context/DataContext'
import { PageHead, Tabs, Modal, ConfirmDialog, Badge, SectionTitle, InfoTip, Empty, ExportMenu } from '../../components/ui'
import { fmtDateTime, fmtBytes, download } from '../../lib/utils'
import config from '../../lib/config'
import idb from '../../lib/db'
import ls from '../../lib/storage'
import { useTabMemory } from '../../lib/router'

export default function Settings() {
  const { data, exportData, importData, resetWorkspaceData, wipeAllData, toast, save, logActivity } = useData()
  const [tab, setTab] = useTabMemory('general')
  const [confirm, setConfirm] = useState(null)
  const [restoreOpen, setRestoreOpen] = useState(false)
  const [restoreText, setRestoreText] = useState('')
  const [usage, setUsage] = useState({ usage: null, quota: null })
  const [settings, setSettings] = useState(() => ls.getSettings({ notifyDeadlines: true, notifyFindings: true, notifyReviews: true, notifyMessages: true, notifyEscalations: true }))

  useEffect(() => {
    idb.estimateUsage().then(setUsage)
  }, [data])

  const set = (k, v) => {
    const next = { ...settings, [k]: v }
    setSettings(next)
    ls.saveSettings(next)
  }

  const storeStats = useMemo(() => {
    const keys = ['users', 'departments', 'audits', 'findings', 'observations', 'documents', 'messages', 'notifications', 'activity', 'transactions', 'reports', 'templates', 'teams', 'loginEvents', 'checklistTemplates', 'integrations', 'emailOutbox']
    return keys.map((k) => ({ store: k, count: (data[k] || []).length }))
  }, [data])

  const sso = (data.integrations || [])[0] || null

  const exportBackup = () => {
    const blob = new Blob([exportData()], { type: 'application/json' })
    download(blob, `ams-backup-${new Date().toISOString().slice(0, 10)}.json`)
    toast('Backup downloaded')
  }

  const activityRows = data.activity.map((a) => ({ time: a.timestamp, user: a.userName, action: a.action, entity: `${a.entityType}/${a.entityId}`, details: a.details, remarks: a.remarks || '', ip: a.ip || '' }))

  return (
    <div>
      <PageHead title="Settings" sub="Workspace configuration, notifications, data management and developer tools" />

      <Tabs
        tabs={[
          { key: 'general', label: 'General' },
          { key: 'notifications', label: 'Notifications' },
          { key: 'data', label: 'Data' },
          { key: 'developer', label: 'Developer' }
        ]}
        active={tab} onChange={setTab}
      />

      {tab === 'general' && (
        <div className="grid grid-2">
          <div className="card">
            <div className="card-head"><h3>Workspace</h3></div>
            <div className="card-pad">
              <div className="kv">
                <div><dt>Application</dt><dd>{config.appName}</dd></div>
                <div><dt>Organisation</dt><dd>{config.orgName} · {config.orgUnit}</dd></div>
                <div><dt>Financial year</dt><dd>FY {config.fiscalYear}</dd></div>
                <div><dt>Sign-in options</dt><dd>Password{config.ssoEnabled ? ` + ${config.ssoProviderName}` : ''}</dd></div>
                <div><dt>Session timeout</dt><dd>{config.sessionTimeoutMin > 0 ? `${config.sessionTimeoutMin} minutes` : 'Disabled'}</dd></div>
              </div>
              <p className="muted small mt-2">These values are read from the <span className="mono">.env</span> file at startup. Adjust the file and restart to change them.</p>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>Storage & Content</h3></div>
            <div className="card-pad">
              <div className="grid grid-2">
                <div className="muted small bold">STORES</div><div />
                {storeStats.map((s) => (
                  <div key={s.store} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, borderBottom: '1px dashed var(--border)', padding: '3px 0' }}>
                    <span className="muted">{s.store}</span><b className="num">{s.count}</b>
                  </div>
                ))}
              </div>
              {usage.usage != null && (
                <p className="muted small mt-2">Local storage used: <b>{fmtBytes(usage.usage)}</b>{usage.quota ? ` of ~${fmtBytes(usage.quota)} available` : ''}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'notifications' && (
        <div className="card" style={{ maxWidth: 620 }}>
          <div className="card-head"><h3>Notification Preferences</h3><span className="hint">applies to your account</span></div>
          <div className="card-pad flex-col" style={{ gap: 14 }}>
            {[
              ['notifyDeadlines', 'Deadlines & due dates', 'Audit end dates, finding and observation due dates'],
              ['notifyFindings', 'Findings', 'New findings raised on your audits or department'],
              ['notifyReviews', 'Reviews & approvals', 'Audits and reports awaiting your action'],
              ['notifyMessages', 'Messages', 'New direct and group conversations'],
              ['notifyEscalations', 'Escalations', 'Compliance escalations with remarks']
            ].map(([key, label, desc]) => (
              <div key={key} className="flex-between">
                <div>
                  <div className="bold small">{label}</div>
                  <div className="muted tiny">{desc}</div>
                </div>
                <label className="switch">
                  <input type="checkbox" checked={settings[key]} onChange={(e) => set(key, e.target.checked)} />
                  <span className="track" />
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'data' && (
        <div className="grid grid-2">
          <div className="card">
            <div className="card-head"><h3>Backup & Restore</h3></div>
            <div className="card-pad">
              <p className="muted small" style={{ marginBottom: 12 }}>Download a full backup of the workspace as JSON, or restore from a previous backup file.</p>
              <div className="flex" style={{ gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={exportBackup}>⇩ Download Backup</button>
                <button className="btn btn-secondary" onClick={() => setRestoreOpen(true)}>⇧ Restore from Backup</button>
                <ExportMenu
                  label="Export Activity Log"
                  title="Export the activity log — choose format"
                  name="activity-log"
                  rows={activityRows}
                />
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>Reset</h3></div>
            <div className="card-pad">
              <p className="muted small" style={{ marginBottom: 12 }}>Restore the workspace to its original content, or clear everything for a fresh start.</p>
              <div className="flex" style={{ gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" onClick={() => setConfirm({ kind: 'reset' })}>↻ Restore Original Content</button>
                <button className="btn btn-danger" onClick={() => setConfirm({ kind: 'wipe' })}>🗑 Clear All Data</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'developer' && (
        <div className="flex-col" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head">
              <h3>Integrations</h3>
              <span className="hint">identity & data connections</span>
            </div>
            <div className="card-pad">
              {sso ? (
                <div style={{ borderLeft: '3px solid var(--success)', paddingLeft: 14 }}>
                  <div className="flex-between">
                    <div>
                      <div className="bold">{sso.name} <Badge kind={sso.status}>{sso.status}</Badge></div>
                      <div className="muted small" style={{ margin: '4px 0' }}>{sso.description}</div>
                      <div className="muted tiny">Endpoint: <span className="mono">{sso.endpoint}</span></div>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={async () => {
                        const status = sso.status === 'Connected' ? 'Disconnected' : 'Connected'
                        await save('integrations', { ...sso, status }, { logAction: `SSO ${status.toLowerCase()}`, logDetail: sso.name })
                        toast(`SSO marked ${status.toLowerCase()}`)
                      }}
                    >
                      {sso.status === 'Connected' ? 'Disconnect' : 'Connect'}
                    </button>
                  </div>
                  <SectionTitle>Sync Log</SectionTitle>
                  <div className="timeline">
                    {sso.logs.map((l, i) => (
                      <div key={i} className="tl-item">
                        <span className={`tl-dot ${l.status === 'OK' ? 'ok' : l.status === 'ERROR' ? 'bad' : ''}`} />
                        <div className="tl-title">{l.event}</div>
                        <div className="tl-meta">{fmtDateTime(l.time)} · {l.status}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <Empty icon="⇄" title="No integrations configured" />}
              <p className="muted tiny mt-2">Additional connectors (payment feeds, treasury, e-office) are not enabled in this build.</p>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>Environment Configuration</h3><span className="hint">values from the .env file</span></div>
            <div className="card-pad grid grid-2" style={{ gap: 20 }}>
              <div>
                <SectionTitle>Application</SectionTitle>
                <div className="mono small" style={{ lineHeight: 2 }}>
                  <div className="flex-between"><span className="muted">APP_NAME</span><b>{config.appName}</b></div>
                  <div className="flex-between"><span className="muted">APP_SHORT_NAME</span><b>{config.appShortName}</b></div>
                  <div className="flex-between"><span className="muted">ORG_NAME</span><b>{config.orgName}</b></div>
                  <div className="flex-between"><span className="muted">ORG_UNIT</span><b>{config.orgUnit}</b></div>
                  <div className="flex-between"><span className="muted">FISCAL_YEAR</span><b>{config.fiscalYear}</b></div>
                  <div className="flex-between"><span className="muted">SSO_ENABLED</span><b>{String(config.ssoEnabled)}</b></div>
                  <div className="flex-between"><span className="muted">ENABLE_AI_FEATURES</span><b>{String(config.aiEnabled)}</b></div>
                </div>
              </div>
              <div>
                <SectionTitle>Storage & Services</SectionTitle>
                <div className="mono small" style={{ lineHeight: 2 }}>
                  <div className="flex-between"><span className="muted">DB_NAME</span><b>{config.dbName}</b></div>
                  <div className="flex-between"><span className="muted">DB_VERSION</span><b>{config.dbVersion}</b></div>
                  <div className="flex-between"><span className="muted">STORAGE_PREFIX</span><b>{config.storagePrefix}</b></div>
                  <div className="flex-between"><span className="muted">MAX_UPLOAD_MB</span><b>{config.maxUploadMb}</b></div>
                  <div className="flex-between"><span className="muted">EMAIL_SIMULATION</span><b>{String(config.emailSimulation)}</b></div>
                  <div className="flex-between"><span className="muted">EMAIL_DOMAIN</span><b>{config.emailDomain}</b></div>
                  <div className="flex-between"><span className="muted">SESSION_TIMEOUT_MIN</span><b>{config.sessionTimeoutMin}</b></div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>Email Gateway</h3><span className="hint">outbound messages</span></div>
            <div className="card-pad">
              {data.emailOutbox.length === 0 && <div className="muted small">No messages sent yet.</div>}
              <div className="timeline">
                {data.emailOutbox.slice(0, 8).map((e) => (
                  <div key={e.id} className="tl-item">
                    <span className="tl-dot" />
                    <div className="tl-title">{e.subject} → {e.to}</div>
                    <div className="tl-meta">{fmtDateTime(e.timestamp)} · {e.via}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>Developer Tools</h3></div>
            <div className="card-pad flex" style={{ gap: 8, flexWrap: 'wrap' }}>
              <ExportMenu
                label="Export Transaction Feed"
                title="Export the transaction feed — choose format"
                name="transaction-feed"
                rows={data.transactions.map((t) => ({ ref: t.refNo, dept: t.departmentId, vendor: t.vendor, amount: t.amount, date: t.date, mode: t.mode }))}
              />
              <button className="btn btn-secondary" onClick={() => { console.log('[AMS] workspace snapshot', JSON.parse(exportData())); toast('Snapshot printed to the browser console') }}>⌨ Log Snapshot to Console</button>
            </div>
          </div>
        </div>
      )}

      {/* restore modal */}
      <Modal
        open={restoreOpen} onClose={() => setRestoreOpen(false)} title="Restore from Backup"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setRestoreOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={!restoreText.trim()} onClick={async () => { await importData(restoreText); setRestoreOpen(false); setRestoreText(''); toast('Workspace restored from backup') }}>Restore</button>
          </>
        }
      >
        <div className="field">
          <label>Backup JSON</label>
          <input className="input" type="file" accept=".json" onChange={async (e) => {
            const file = e.target.files && e.target.files[0]
            if (file) setRestoreText(await file.text())
          }} />
          {restoreText && <span className="help">Loaded {fmtBytes(restoreText.length)} — click Restore to apply.</span>}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirm} onClose={() => setConfirm(null)}
        title={confirm && confirm.kind === 'reset' ? 'Restore original content' : 'Clear all data'}
        message={confirm && confirm.kind === 'reset'
          ? 'All changes will be replaced with the original workspace content. Continue?'
          : 'This removes ALL data from this browser. The app will be empty afterwards. Continue?'}
        confirmLabel={confirm && confirm.kind === 'reset' ? 'Restore' : 'Clear Everything'}
        danger={confirm && confirm.kind === 'wipe'}
        onConfirm={async () => {
          if (confirm.kind === 'reset') { await resetWorkspaceData(); toast('Workspace restored to original content') }
          else { await wipeAllData(); toast('All data cleared') }
          setConfirm(null)
        }}
      />
    </div>
  )
}
