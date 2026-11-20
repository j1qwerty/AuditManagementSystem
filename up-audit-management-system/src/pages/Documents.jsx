// Document repository (FR-080 to FR-084): central storage (IndexedDB blobs),
// version control, secure sharing, search & retrieval. Every action is
// captured in the activity trail.
import { useMemo, useState, useRef } from 'react'
import { useData } from '../context/DataContext'
import { Badge, Empty, Modal, StatCard, Pagination } from '../components/ui'
import { fmtDate, fmtRelative, fmtBytes, uid, todayISO, download } from '../lib/utils'
import idb from '../lib/db'
import config from '../lib/config'
import { can } from '../lib/permissions'

const CATEGORIES = ['Policy', 'Guideline', 'Circular', 'Report', 'Template']

export default function Documents() {
  const { data, currentUser, save, toast, logActivity } = useData()
  const [q, setQ] = useState('')
  const [fCat, setFCat] = useState('All')
  const [page, setPage] = useState(1)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [shareFor, setShareFor] = useState(null)
  const [versionFor, setVersionFor] = useState(null)
  const fileRef = useRef(null)
  const pageSize = config.pageSize

  const rows = useMemo(
    () =>
      data.documents
        .filter((d) => (fCat === 'All' ? true : d.category === fCat))
        .filter((d) => (d.name + (d.tags || []).join(' ') + (d.description || '')).toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)),
    [data.documents, q, fCat]
  )
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const curPage = Math.min(page, pages)
  const paged = rows.slice((curPage - 1) * pageSize, curPage * pageSize)

  const doDownload = async (doc, version) => {
    const rec = await idb.get('files', version ? version.fileId : doc.fileId)
    if (!rec) { toast('Blob not found in local store.', 'error'); return }
    download(rec.blob, rec.name || doc.name)
    await logActivity('Downloaded document', 'Document', doc.id, `${doc.name} (v${version ? version.v : doc.versions.length})`)
  }

  const upload = async (form) => {
    const file = form.file
    if (!file) { toast('Choose a file first.', 'error'); return }
    if (file.size > config.maxUploadMb * 1048576) { toast(`Max ${config.maxUploadMb} MB in this demo.`, 'error'); return }
    const fileId = uid('file')
    await idb.put('files', { id: fileId, name: file.name, blob: file })
    const doc = {
      id: uid('doc'),
      name: form.name || file.name,
      category: form.category,
      departmentId: form.departmentId || null,
      ownerId: currentUser.id,
      ownerName: currentUser.name,
      tags: (form.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
      type: file.type || 'application/octet-stream',
      size: file.size,
      uploadedAt: todayISO(),
      versions: [{ v: 1, uploadedAt: todayISO(), by: currentUser.name, size: file.size, fileId, note: 'Initial upload' }],
      sharedWith: [],
      description: form.description || '',
      fileId
    }
    await save('documents', doc, { logAction: 'Uploaded document', logDetail: doc.name })
    toast('Document stored in the local repository (IndexedDB).')
    setUploadOpen(false)
  }

  const share = async (doc, userIds, permission) => {
    const sharedWith = userIds.map((id) => {
      const u = data.users.find((x) => x.id === id)
      return { userId: id, name: u ? u.name : id, permission }
    })
    await save('documents', { ...doc, sharedWith }, { logAction: 'Shared document', logDetail: `${doc.name} shared with ${sharedWith.length} user(s)` })
    toast(`Document shared with ${sharedWith.length} user(s) — ${permission} access (FR-082).`)
    setShareFor(null)
  }

  const restoreVersion = async (doc, version) => {
    const versions = doc.versions.map((v) => ({ ...v }))
    const rec = await idb.get('files', version.fileId)
    const newVersion = { v: doc.versions.length + 1, uploadedAt: todayISO(), by: currentUser.name, size: version.size, fileId: version.fileId, note: `Restored from v${version.v}` }
    await save('documents', { ...doc, versions: [...versions, newVersion], fileId: version.fileId, size: version.size, uploadedAt: todayISO() }, { logAction: 'Restored document version', logDetail: `${doc.name} restored to v${version.v}` })
    toast(`Restored v${version.v} as v${newVersion.v} (version history preserved).`)
    setVersionFor(null)
    if (rec) download(rec.blob, rec.name)
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Document Repository</h1>
          <div className="sub">Central document store with version control, sharing and full-text search. Files are stored as blobs in your browser (FR-080 to FR-084).</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setUploadOpen(true)}>⤒ Upload document</button>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Documents" value={data.documents.length} icon="▤" accent />
        <StatCard label="Categories" value={new Set(data.documents.map((d) => d.category)).size} icon="▤" />
        <StatCard label="Shared documents" value={data.documents.filter((d) => d.sharedWith.length > 0).length} icon="⇄" />
        <StatCard label="Total versions tracked" value={data.documents.reduce((s, d) => s + d.versions.length, 0)} icon="◔" />
      </div>

      <div className="filter-bar">
        <input className="input search" placeholder="Search name, tag, description…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        <select className="select" value={fCat} onChange={(e) => setFCat(e.target.value)}>
          <option>All</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <span className="muted small">{rows.length} documents</span>
      </div>

      <div className="card">
        <div className="table-wrap">
          {rows.length === 0 ? (
            <div className="card-body"><Empty icon="▤" title="No documents found" sub="Upload one or adjust the filters." /></div>
          ) : (
            <table className="tbl">
              <thead><tr><th>Document</th><th>Category</th><th>Department</th><th>Owner</th><th className="num">Versions</th><th>Shared with</th><th>Updated</th><th className="num">Size</th><th></th></tr></thead>
              <tbody>
                {paged.map((d) => (
                  <tr key={d.id}>
                    <td className="strong" style={{ maxWidth: 300 }}>{d.name}
                      <div className="sub">{(d.tags || []).map((t) => <span key={t} className="tag">#{t}</span>)}</div>
                    </td>
                    <td><Badge kind="Active">{d.category}</Badge></td>
                    <td className="small">{(data.departments.find((dp) => dp.id === d.departmentId) || {}).name || '—'}</td>
                    <td className="small">{d.ownerName}</td>
                    <td className="num"><button className="link" onClick={() => setVersionFor(d)}>{d.versions.length}</button></td>
                    <td className="small">{d.sharedWith.length ? d.sharedWith.map((s) => s.name.split(' ')[0]).join(', ') : <span className="muted">private</span>}</td>
                    <td className="small">{fmtRelative(d.uploadedAt)}</td>
                    <td className="num small">{fmtBytes(d.size)}</td>
                    <td className="right">
                      <button className="btn btn-secondary btn-sm" onClick={() => doDownload(d)} title="Download latest">⤓</button>
                      {can(currentUser, 'document.share') && <button className="btn btn-secondary btn-sm" onClick={() => setShareFor(d)} title="Share">⇄</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ padding: '0 14px 12px' }}>
          <Pagination page={curPage} pages={pages} onPage={setPage} total={rows.length} pageSize={pageSize} />
        </div>
      </div>

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} onUpload={upload} departments={data.departments} fileRef={fileRef} />
      <ShareModal open={!!shareFor} doc={shareFor} users={data.users.filter((u) => u.id !== currentUser.id)} onClose={() => setShareFor(null)} onShare={share} />

      <Modal open={!!versionFor} onClose={() => setVersionFor(null)} title={versionFor ? `Version history — ${versionFor.name}` : ''}>
        {versionFor && (
          <table className="tbl">
            <thead><tr><th>v</th><th>Uploaded</th><th>By</th><th className="num">Size</th><th>Note</th><th></th></tr></thead>
            <tbody>
              {versionFor.versions.slice().reverse().map((v) => (
                <tr key={v.v}>
                  <td className="strong">{v.v}</td>
                  <td className="small">{fmtDate(v.uploadedAt)}</td>
                  <td className="small">{v.by}</td>
                  <td className="num small">{fmtBytes(v.size)}</td>
                  <td className="small muted">{v.note}</td>
                  <td className="right">
                    <button className="btn btn-secondary btn-sm" onClick={() => doDownload(versionFor, v)}>⤓</button>
                    {v.v !== versionFor.versions.length && <button className="btn btn-secondary btn-sm" onClick={() => restoreVersion(versionFor, v)}>Restore</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Modal>
    </div>
  )
}

function UploadModal({ open, onClose, onUpload, departments, fileRef }) {
  const [form, setForm] = useState({ name: '', category: 'Guideline', departmentId: '', tags: '', description: '', file: null })
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  return (
    <Modal open={open} onClose={onClose} title="Upload document"
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={() => onUpload(form)}>Upload</button></>}>
      <div className="field"><label>File *</label>
        <input ref={fileRef} className="input" type="file" onChange={(e) => set('file', e.target.files[0])} /></div>
      <div className="form-row">
        <div className="field"><label>Display name</label>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Defaults to file name" /></div>
        <div className="field"><label>Category</label>
          <select className="select" value={form.category} onChange={(e) => set('category', e.target.value)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select></div>
      </div>
      <div className="form-row">
        <div className="field"><label>Department (optional)</label>
          <select className="select" value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
            <option value="">— None —</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select></div>
        <div className="field"><label>Tags (comma separated)</label>
          <input className="input" value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="tender, GFR" /></div>
      </div>
      <div className="field"><label>Description</label>
        <textarea className="textarea" value={form.description} onChange={(e) => set('description', e.target.value)} /></div>
    </Modal>
  )
}

function ShareModal({ open, doc, users, onClose, onShare }) {
  const [selected, setSelected] = useState([])
  const [permission, setPermission] = useState('View')
  if (!doc) return null
  return (
    <Modal open={open} onClose={onClose} title={`Share — ${doc.name}`}
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={() => onShare(doc, selected, permission)}>Share with {selected.length} user(s)</button></>}>
      <div className="field"><label>Users</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {users.map((u) => {
            const checked = selected.includes(u.id)
            return (
              <label key={u.id} style={{ border: `1px solid ${checked ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 8, padding: '7px 10px', cursor: 'pointer' }}>
                <span className="checkbox-row" style={{ padding: 0 }}>
                  <input type="checkbox" checked={checked} onChange={() => setSelected(checked ? selected.filter((x) => x !== u.id) : [...selected, u.id])} />
                  <span className="small">{u.name}</span>
                </span>
              </label>
            )
          })}
        </div></div>
      <div className="field"><label>Permission</label>
        <select className="select" value={permission} onChange={(e) => setPermission(e.target.value)}>
          <option>View</option><option>Edit</option>
        </select></div>
    </Modal>
  )
}
