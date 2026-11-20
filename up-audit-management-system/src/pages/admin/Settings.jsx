// System settings (admin): configuration overview, data & storage management
// (export / import / reset / wipe), retention policy and email outbox log.
import { useEffect, useState } from 'react'
import { useData } from '../../context/DataContext'
import { Badge, ConfirmDialog, Empty, StatCard, Tabs } from '../../components/ui'
import { fmtBytes, fmtDateTime, download } from '../../lib/utils'
import idb from '../../lib/db'
import config from '../../lib/config'
import ls from '../../lib/storage'

export default function Settings() {
  const { data, exportData, importData, resetDemoData, wipeAllData, toast } = useData()
  const [tab, setTab] = useState('general')
  const [usage, setUsage] = useState({ usage: null, quota: null })
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [settings, setSettings] = useState(() => ls.getSettings({ retentionYears: 7, escalationReminderDays: 7, escalationL1Days: 7, escalationL2Days: 14, escalationL3Days: 30 }))
  const fileRef = useState(null)

  useEffect(() => {
    idb.estimateUsage().then(setUsage)
  }, [data])

  const saveSettings = () => {
    ls.saveSettings(settings)
    toast('Settings saved to browser localStorage.')
  }

  const doExport = () => {
    const json = exportData()
    download(new Blob([json], { type: 'application/json' }), `up-ams-backup-${new Date().toISOString().slice(0, 10)}.json`)
    toast('Full data backup exported as JSON.')
  }

  const doImport = (e) => {
    const f = e.target.files && e.target.files[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        await importData(reader.result)
        toast('Backup imported successfully.')
      } catch (err) {
        toast('Import failed — invalid backup file.', 'error')
      }
    }
    reader.readAsText(f)
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <div className="sub">System configuration, data management, retention policy and the simulated email outbox. Identity & endpoint settings come from the .env file.</div>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Browser storage used" value={usage.usage ? fmtBytes(usage.usage) : '…'} icon="▤" accent delta={{ text: usage.quota ? `of ${fmtBytes(usage.quota)} available` : 'navigator.storage.estimate()', dir: 'up' }} />
        <StatCard label="Records in database" value={Object.keys(data).reduce((s, k) => s + (Array.isArray(data[k]) ? data[k].length : 0), 0)} icon="⚙" />
        <StatCard label="Demo mode" value={config.demoMode ? 'ON' : 'OFF'} icon="◈" delta={{ text: 'VITE_DEMO_MODE in .env', dir: 'up' }} />
        <StatCard label="AI features" value={config.aiEnabled ? 'ON' : 'OFF'} icon="◔" delta={{ text: config.aiModelLabel, dir: 'up' }} />
      </div>

      <Tabs
        tabs={[
          { key: 'general', label: 'General & .env' },
          { key: 'data', label: 'Data & Storage' },
          { key: 'policy', label: 'Retention & Escalation' },
          { key: 'email', label: 'Email Outbox (simulated)', count: data.emailOutbox.length }
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'general' && (
        <div className="card">
          <div className="card-head"><h3>Configuration from .env file</h3><span className="hint">edit .env and restart the dev server to change</span></div>
          <div className="card-body">
            <table className="tbl">
              <thead><tr><th>Setting</th><th>Env variable</th><th>Current value</th></tr></thead>
              <tbody>
                {[
                  ['Application name', 'VITE_APP_NAME', config.appName],
                  ['Organisation', 'VITE_ORG_NAME', config.orgName],
                  ['Organisation unit', 'VITE_ORG_UNIT', config.orgUnit],
                  ['Financial year', 'VITE_FISCAL_YEAR', config.fiscalYear],
                  ['Demo mode', 'VITE_DEMO_MODE', String(config.demoMode)],
                  ['Seed demo data', 'VITE_SEED_DEMO_DATA', String(config.seedDemoData)],
                  ['AI features', 'VITE_ENABLE_AI_FEATURES', String(config.aiEnabled)],
                  ['SSO provider', 'VITE_SSO_PROVIDER_NAME', config.ssoProviderName],
                  ['PFMS endpoint', 'VITE_PFMS_ENDPOINT', config.endpoints.pfms],
                  ['e-Office endpoint', 'VITE_EOFFICE_ENDPOINT', config.endpoints.eoffice],
                  ['Kosh endpoint', 'VITE_KOSH_ENDPOINT', config.endpoints.kosh],
                  ['DDO endpoint', 'VITE_DDO_ENDPOINT', config.endpoints.ddo],
                  ['IndexedDB name', 'VITE_DB_NAME', config.dbName],
                  ['Max upload size', 'VITE_MAX_UPLOAD_MB', `${config.maxUploadMb} MB`],
                  ['Page size (tables)', 'VITE_DEFAULT_PAGE_SIZE', String(config.pageSize)],
                  ['Session timeout', 'VITE_SESSION_TIMEOUT_MINUTES', config.sessionTimeoutMin === 0 ? 'Never (demo)' : `${config.sessionTimeoutMin} minutes`],
                  ['Email simulation', 'VITE_EMAIL_SIMULATION', String(config.emailSimulation)]
                ].map(([label, envVar, value]) => (
                  <tr key={envVar}>
                    <td className="strong">{label}</td>
                    <td><code style={{ fontSize: 11.5, background: 'var(--neutral-soft)', padding: '2px 6px', borderRadius: 4 }}>{envVar}</code></td>
                    <td className="small">{String(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'data' && (
        <div>
          <div className="grid-2">
            <div className="card">
              <div className="card-head"><h3>Backup & restore</h3><span className="hint">FR interoperability — JSON data exchange</span></div>
              <div className="card-body">
                <p className="small muted">Export every record (users, audits, findings, observations, documents metadata, messages, activity) as a single JSON file. Import restores it on any machine.</p>
                <div className="flex mt-2" style={{ gap: 8 }}>
                  <button className="btn btn-primary" onClick={doExport}>⤓ Export all data (JSON)</button>
                  <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                    ⤒ Import backup
                    <input type="file" accept="application/json" style={{ display: 'none' }} onChange={doImport} />
                  </label>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-head"><h3>Danger zone</h3></div>
              <div className="card-body">
                <div className="flex-between mb-2" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <b className="small">Reset demo data</b>
                    <div className="muted small">Wipe the browser database and re-seed the original demo dataset.</div>
                  </div>
                  <button className="btn btn-secondary" onClick={() => setConfirmReset(true)}>Reset</button>
                </div>
                <div className="flex-between" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <b className="small">Wipe everything</b>
                    <div className="muted small">Delete all local data and start with an empty system.</div>
                  </div>
                  <button className="btn btn-danger" onClick={() => setConfirmWipe(true)}>Wipe</button>
                </div>
              </div>
            </div>
          </div>
          <div className="card mt-3">
            <div className="card-head"><h3>Storage breakdown</h3><span className="hint">record counts per store</span></div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
                {Object.keys(data).filter((k) => Array.isArray(data[k])).map((k) => (
                  <div key={k} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
                    <div className="muted small">{k}</div>
                    <b style={{ fontSize: 17 }}>{data[k].length}</b>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'policy' && (
        <div className="card" style={{ maxWidth: 640 }}>
          <div className="card-head"><h3>Retention & escalation policy</h3><span className="hint">saved in browser localStorage</span></div>
          <div className="card-body">
            <div className="form-row">
              <div className="field"><label>Record retention (years)</label>
                <input className="input" type="number" value={settings.retentionYears} onChange={(e) => setSettings({ ...settings, retentionYears: Number(e.target.value) })} /></div>
              <div className="field"><label>Reminder before due (days)</label>
                <input className="input" type="number" value={settings.escalationReminderDays} onChange={(e) => setSettings({ ...settings, escalationReminderDays: Number(e.target.value) })} /></div>
            </div>
            <div className="form-row-3">
              <div className="field"><label>Escalate L1 after (days overdue)</label>
                <input className="input" type="number" value={settings.escalationL1Days} onChange={(e) => setSettings({ ...settings, escalationL1Days: Number(e.target.value) })} /></div>
              <div className="field"><label>Escalate L2 after</label>
                <input className="input" type="number" value={settings.escalationL2Days} onChange={(e) => setSettings({ ...settings, escalationL2Days: Number(e.target.value) })} /></div>
              <div className="field"><label>Escalate L3 after</label>
                <input className="input" type="number" value={settings.escalationL3Days} onChange={(e) => setSettings({ ...settings, escalationL3Days: Number(e.target.value) })} /></div>
            </div>
            <div className="callout">
              Retention policy (data retention, archival, deletion, legal hold) is a recommended NFR from the requirement
              document. In this demo the values are stored locally and displayed here — a production system would enforce
              them via scheduled jobs.
            </div>
            <button className="btn btn-primary mt-2" onClick={saveSettings}>Save policy</button>
          </div>
        </div>
      )}

      {tab === 'email' && (
        <div className="card">
          <div className="card-head"><h3>Simulated email outbox</h3><span className="hint">FR-052 — nothing actually leaves the machine</span></div>
          <div className="table-wrap">
            {data.emailOutbox.length === 0 ? (
              <div className="card-body"><Empty icon="✉" title="Outbox empty" sub="Reminder and message emails (simulated) will be listed here." /></div>
            ) : (
              <table className="tbl">
                <thead><tr><th>To</th><th>Subject</th><th>Body</th><th>Sent</th><th>Channel</th></tr></thead>
                <tbody>
                  {data.emailOutbox.map((e) => (
                    <tr key={e.id}>
                      <td className="small strong">{e.to}</td>
                      <td className="small">{e.subject}</td>
                      <td className="small muted" style={{ maxWidth: 380 }}>{e.body}</td>
                      <td className="small">{fmtDateTime(e.timestamp)}</td>
                      <td><Badge kind="Active">{e.via}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog open={confirmReset} onClose={() => setConfirmReset(false)} onConfirm={async () => { await resetDemoData(); setConfirmReset(false); toast('Demo data reset — the app will reload.'); setTimeout(() => window.location.reload(), 600) }}
        title="Reset demo data" message="This wipes the browser database and re-seeds the original demo dataset. Any changes you made will be lost." confirmLabel="Reset data" danger />
      <ConfirmDialog open={confirmWipe} onClose={() => setConfirmWipe(false)} onConfirm={async () => { await wipeAllData(); setConfirmWipe(false); toast('All data wiped. Reloading…'); setTimeout(() => window.location.reload(), 600) }}
        title="Wipe all data" message="This deletes ALL local data (audits, findings, documents, users, messages). The app will restart empty — you can re-seed from Settings by clearing site data." confirmLabel="Wipe everything" danger />
    </div>
  )
}
