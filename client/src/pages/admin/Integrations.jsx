// Integrations (FR-100 to FR-103): PFMS feed, SSO, e-Office and third-party
// APIs. All endpoints come from .env; sync actions are simulated and logged.
import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { Badge, Empty, StatCard, Modal } from '../../components/ui'
import { fmtDateTime, fmtRelative, todayISO, uid } from '../../lib/utils'
import config from '../../lib/config'

export default function Integrations() {
  const { data, save, toast, notify, logActivity } = useData()
  const [configure, setConfigure] = useState(null)
  const [configForm, setConfigForm] = useState({})

  const sync = async (integration) => {
    const records = 20 + Math.floor(Math.random() * 80)
    const updated = {
      ...integration,
      status: 'Connected',
      lastSync: todayISO(),
      recordsSynced: (integration.recordsSynced || 0) + records,
      logs: [
        { time: todayISO(), event: `Manual sync completed — ${records} records ingested (demo simulation)`, status: 'OK' },
        ...integration.logs
      ].slice(0, 20)
    }
    await save('integrations', updated, { logAction: 'Synced integration', logDetail: `${integration.name} — ${records} records` })
    await notify('*', 'Integration', `${integration.name.split(' - ')[0]} sync completed`, `${records} records ingested from the mock endpoint (demo).`, '/integrations')
    toast(`${integration.name.split(' - ')[0]}: ${records} records synced (simulated — no external calls are made).`)
  }

  const toggle = async (integration) => {
    const status = integration.status === 'Disconnected' ? 'Connected' : 'Disconnected'
    await save('integrations', {
      ...integration, status,
      logs: [{ time: todayISO(), event: status === 'Connected' ? 'Connection enabled by administrator' : 'Connection disabled by administrator', status: 'INFO' }, ...integration.logs]
    }, { logAction: 'Updated integration', logDetail: `${integration.name} → ${status}` })
    toast(`${integration.name.split(' - ')[0]} is now ${status.toLowerCase()}.`)
  }

  const saveConfig = async () => {
    await save('integrations', { ...configure, config: { ...configure.config, ...configForm } }, { logAction: 'Updated integration config', logDetail: configure.name })
    toast('Integration configuration saved locally.')
    setConfigure(null)
    setConfigForm({})
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Integrations</h1>
          <div className="sub">Government system integrations — PFMS, SSO, e-Office, treasury and DDO APIs (FR-100 to FR-103). Endpoints are configured via the .env file; sync is simulated in the demo.</div>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Configured integrations" value={data.integrations.length} icon="⇄" accent />
        <StatCard label="Connected" value={data.integrations.filter((i) => i.status === 'Connected').length} icon="✓" />
        <StatCard label="Errors" value={data.integrations.filter((i) => i.status === 'Error').length} icon="⚠" />
        <StatCard label="Records synced (PFMS)" value={data.integrations.find((i) => i.id === 'int1') ? data.integrations.find((i) => i.id === 'int1').recordsSynced : 0} icon="⤓" />
      </div>

      {data.integrations.length === 0 && <Empty icon="⇄" title="No integrations configured" />}

      <div className="grid-2">
        {data.integrations.map((i) => (
          <div className="card" key={i.id}>
            <div className="card-head">
              <div>
                <h3>{i.name}</h3>
                <div className="hint">{i.type}</div>
              </div>
              <Badge kind={i.status}>{i.status}</Badge>
            </div>
            <div className="card-body">
              <p className="small muted" style={{ lineHeight: 1.55 }}>{i.description}</p>
              <div className="small" style={{ margin: '8px 0' }}>
                <span className="muted">Endpoint:</span> <code style={{ fontSize: 11.5, background: 'var(--neutral-soft)', padding: '2px 6px', borderRadius: 4 }}>{i.endpoint}</code>
              </div>
              <div className="small muted">
                Last sync: {i.lastSync ? fmtDateTime(i.lastSync) : '—'}
                {i.recordsSynced ? ` · ${i.recordsSynced.toLocaleString('en-IN')} records` : ''}
              </div>
              <hr className="divider" />
              <b className="small">Recent activity</b>
              <ul className="timeline mt-1">
                {i.logs.slice(0, 3).map((l, idx) => (
                  <li key={idx}>
                    <div className="tt small">{l.event}</div>
                    <div className="td">{fmtRelative(l.time)} · {l.status}</div>
                  </li>
                ))}
              </ul>
              <div className="flex mt-2" style={{ gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={() => sync(i)}>⟳ Sync now</button>
                <button className="btn btn-secondary btn-sm" onClick={() => { setConfigure(i); setConfigForm({}) }}>Configure</button>
                {i.status !== 'Error' && <button className="btn btn-secondary btn-sm" onClick={() => toggle(i)}>{i.status === 'Connected' ? 'Disable' : 'Enable'}</button>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="callout mt-3">
        <b>Data exchange protocol note (FR-103):</b> in production these integrations exchange data over REST/SOAP with
        mutual authentication, signed payloads and an error/retry queue. In this demo everything is simulated locally —
        no external network calls are made from your browser. Change the endpoints in the <b>.env</b> file.
      </div>

      <Modal open={!!configure} onClose={() => setConfigure(null)} title={configure ? `Configure — ${configure.name}` : ''}
        footer={<><button className="btn btn-secondary" onClick={() => setConfigure(null)}>Cancel</button><button className="btn btn-primary" onClick={saveConfig}>Save configuration</button></>}>
        {configure && (
          <div>
            {Object.entries(configure.config || {}).map(([k, v]) => (
              <div className="field" key={k}>
                <label>{k}</label>
                <input className="input" defaultValue={v} onChange={(e) => setConfigForm((f) => ({ ...f, [k]: e.target.value }))} />
              </div>
            ))}
            <div className="field"><label>Endpoint (read-only, from .env)</label>
              <input className="input" value={configure.endpoint} disabled /></div>
          </div>
        )}
      </Modal>
    </div>
  )
}
