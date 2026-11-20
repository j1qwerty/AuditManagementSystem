// Document Repository - central store with version control, preview, sharing
// and full-text search. Supports PDF, images, text, Word and Excel/CSV files.
import { useMemo, useState } from 'react'
import { useData } from '../context/DataContext'
import {
  Badge, DataTable, PageHead, Modal, ConfirmDialog, StatCard, UserPicker, FilePreviewModal, Avatar, InfoTip, SectionTitle
} from '../components/ui'
import { uid, fmtDate, fmtDateTime, fmtBytes, fileKind, cx } from '../lib/utils'

const CATEGORIES = ['Policy', 'Guideline', 'Template', 'Report', 'Circular', 'Working Paper', 'Correspondence']
const KINDS = ['pdf', 'image', 'word', 'excel', 'text']

const KIND_META = {
  pdf: { label: 'PDF', color: '#cc004e', soft: '#ffe5ef' },
  image: { label: 'Image', color: '#0488fb', soft: '#e6f3ff' },
  word: { label: 'Word', color: '#036dc9', soft: '#cde7fe' },
  excel: { label: 'Excel / CSV', color: '#0f9d6e', soft: '#e7f6ef' },
  text: { label: 'Text', color: '#8d7f9a', soft: 'var(--surface-2)' },
  other: { label: 'File', color: '#70428a', soft: '#f3eef7' }
}

export default function Documents() {
  const { data, save, remove, saveFile, notify, currentUser, can, toast } = useData()
  const [catF, setCatF] = useState('all')
  const [kindF, setKindF] = useState('all')
  const [deptF, setDeptF] = useState('all')
  const [preview, setPreview] = useState(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [shareDoc, setShareDoc] = useState(null)
  const [versionDoc, setVersionDoc] = useState(null)
  const [editDoc, setEditDoc] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)

  const deptName = (id) => (data.departments.find((d) => d.id === id) || {}).name || '—'
  const kindOf = (d) => fileKind(d.name || d.type)

  const rows = useMemo(
    () =>
      data.documents
        .filter((d) => catF === 'all' || d.category === catF)
        .filter((d) => kindF === 'all' || kindOf(d) === kindF)
        .filter((d) => deptF === 'all' || d.departmentId === deptF),
    [data.documents, catF, kindF, deptF]
  )

  const upload = async ({ name, file, category, departmentId, description, tags }) => {
    const fileId = uid('docf')
    await saveFile(fileId, name, file)
    const doc = {
      id: uid('doc'), name, category, departmentId: departmentId || null,
      ownerId: currentUser.id, ownerName: currentUser.name,
      tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      size: file.size, type: file.type,
      uploadedAt: new Date().toISOString(),
      versions: [{ v: 1, uploadedAt: new Date().toISOString(), by: currentUser.name, size: file.size, fileId, note: 'Initial upload' }],
      sharedWith: [], description: description || '', fileId
    }
    await save('documents', doc, { logAction: 'Uploaded document', logDetail: name })
    setUploadOpen(false)
    toast('Document uploaded to the repository')
  }

  const uploadVersion = async ({ note, file }) => {
    const doc = versionDoc
    const v = doc.versions.length + 1
    const fileId = `${doc.id}_v${v}_${Date.now().toString(36)}`
    await saveFile(fileId, file.name, file)
    const versions = [...doc.versions, { v, uploadedAt: new Date().toISOString(), by: currentUser.name, size: file.size, fileId, note: note || `Revision ${v}` }]
    await save('documents', { ...doc, versions, size: file.size, type: file.type, fileId, uploadedAt: new Date().toISOString() }, { logAction: 'Uploaded new version', logDetail: `${doc.name} → v${v}` })
    await notify(doc.sharedWith.map((s) => s.userId), 'Integration', `Document updated — ${doc.name}`, `Version ${v} uploaded by ${currentUser.name}`, '#/documents')
    setVersionDoc(null)
    toast(`Version ${v} uploaded`)
  }

  const share = async (ids, permission) => {
    const doc = shareDoc
    const users = data.users.filter((u) => ids.includes(u.id))
    const sharedWith = users.map((u) => ({ userId: u.id, name: u.name, permission }))
    await save('documents', { ...doc, sharedWith }, { logAction: 'Shared document', logDetail: `${doc.name} shared with ${users.length} people` })
    await notify(ids, 'Integration', `Document shared with you — ${doc.name}`, `Shared by ${currentUser.name} (${permission} access)`, '#/documents')
    setShareDoc(null)
    toast(`Shared with ${users.length} people`)
  }

  const deleteDoc = async () => {
    await remove('documents', confirmDel.id, { logAction: 'Deleted document', logDetail: confirmDel.name })
    setConfirmDel(null); setPreview(null)
    toast('Document deleted')
  }

  const saveEdit = async (form) => {
    const doc = data.documents.find((d) => d.id === editDoc.id)
    await save('documents', {
      ...doc, name: form.name, category: form.category, departmentId: form.departmentId || null,
      description: form.description, tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : []
    }, { logAction: 'Updated document', logDetail: form.name })
    setEditDoc(null)
    toast('Document details updated')
  }

  return (
    <div>
      <PageHead
        title="Document Repository"
        sub={`${data.documents.length} documents · version-controlled, searchable and shareable`}
        actions={can('document.upload') ? <button className="btn btn-primary" onClick={() => setUploadOpen(true)}>+ Upload Document</button> : null}
      />

      <div className="grid grid-4 mb-3">
        {KINDS.map((k) => (
          <StatCard
            key={k}
            label={`${KIND_META[k].label} files`}
            value={data.documents.filter((d) => kindOf(d) === k).length}
            strip={KIND_META[k].color}
            onClick={() => setKindF(k)}
            foot="click to filter"
          />
        ))}
      </div>

      <DataTable
        rows={rows}
        columns={[
          {
            key: 'name', label: 'Document', sortable: true,
            render: (d) => {
              const k = kindOf(d)
              return (
                <div className="flex" style={{ gap: 10 }}>
                  <span className="tag" style={{ background: KIND_META[k].soft, color: KIND_META[k].color, borderColor: 'transparent', fontWeight: 800 }}>{KIND_META[k].label}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="cell-strong ellipsis" style={{ maxWidth: 280 }} title={d.name}>{d.name}</div>
                    <div className="cell-sub">{d.category}{d.tags.length ? ` · ${d.tags.slice(0, 3).join(', ')}` : ''}</div>
                  </div>
                </div>
              )
            }
          },
          { key: 'category', label: 'Category', sortable: true, render: (d) => <span className="small">{d.category}</span> },
          { key: 'departmentId', label: 'Department', sortable: true, sort: (d) => deptName(d.departmentId), render: (d) => <span className="small">{d.departmentId ? deptName(d.departmentId) : <span className="muted">All</span>}</span> },
          { key: 'ownerName', label: 'Owner', sortable: true, render: (d) => <span className="small">{d.ownerName}</span> },
          {
            key: 'versions', label: 'Versions', num: true, sortable: true, sort: (d) => d.versions.length,
            render: (d) => (
              <span className="flex" style={{ gap: 6 }} title={d.versions.map((v) => `v${v.v} — ${v.by} — ${v.note}`).join('\n')}>
                <span className="badge purple">v{d.versions.length}</span>
                {can('document.upload') && (
                  <button
                    className="btn-icon" style={{ width: 24, height: 24, fontSize: 11 }} title="Upload new version"
                    onClick={() => setVersionDoc(d)}
                  >⇧</button>
                )}
              </span>
            )
          },
          { key: 'size', label: 'Size', num: true, sortable: true, render: (d) => <span className="num small">{fmtBytes(d.size)}</span> },
          {
            key: 'sharedWith', label: 'Shared', num: true, sortable: true, sort: (d) => d.sharedWith.length,
            render: (d) => (
              <span className="flex" style={{ gap: 6 }}>
                {d.sharedWith.length
                  ? <span title={d.sharedWith.map((s) => `${s.name} (${s.permission})`).join(', ')}>{d.sharedWith.map((s, i) => <Avatar key={i} name={s.name} sm title={`${s.name} · ${s.permission}`} />)}</span>
                  : <span className="muted small">Private</span>}
              </span>
            )
          },
          { key: 'uploadedAt', label: 'Updated', sortable: true, sort: (d) => d.uploadedAt, render: (d) => <span className="small nowrap">{fmtDate(d.uploadedAt)}</span> },
          {
            key: '__actions', label: '', render: (d) => (
              <div className="row-actions">
                <button className="btn-icon" title="Preview" onClick={() => setPreview(d)}>👁</button>
                {can('document.share') && <button className="btn-icon" title="Share" onClick={() => setShareDoc(d)}>↗</button>}
                {can('document.upload') && <button className="btn-icon" title="Edit details" onClick={() => setEditDoc(d)}>✎</button>}
                {can('document.delete') && <button className="btn-icon danger" title="Delete" onClick={() => setConfirmDel(d)}>🗑</button>}
              </div>
            )
          }
        ]}
        searchKeys={['name', 'category', 'ownerName', (d) => d.tags.join(' '), (d) => deptName(d.departmentId)]}
        searchPlaceholder="Search documents, tags, owners…"
        filters={[
          { value: catF, onChange: setCatF, options: [{ value: 'all', label: 'All categories' }, ...CATEGORIES.map((c) => ({ value: c, label: c }))] },
          { value: kindF, onChange: setKindF, options: [{ value: 'all', label: 'All file types' }, ...KINDS.map((k) => ({ value: k, label: KIND_META[k].label }))] },
          { value: deptF, onChange: setDeptF, options: [{ value: 'all', label: 'All departments' }, ...data.departments.map((d) => ({ value: d.id, label: d.name }))] }
        ]}
        rowClick={(d) => setPreview(d)}
        csvName="documents"
        emptyTitle="No documents match"
        emptySub="Adjust filters or upload a new document."
      />

      {/* preview */}
      {preview && <FilePreviewModal open onClose={() => setPreview(null)} fileId={preview.fileId} name={preview.name} />}

      {/* upload */}
      {uploadOpen && <UploadModal onClose={() => setUploadOpen(false)} onSave={upload} data={data} />}

      {/* version upload */}
      {versionDoc && <VersionModal doc={versionDoc} onClose={() => setVersionDoc(null)} onSave={uploadVersion} />}

      {/* share */}
      <UserPicker
        open={!!shareDoc} onClose={() => setShareDoc(null)}
        users={data.users.filter((u) => u.id !== (shareDoc || {}).ownerId)}
        multi initialSelected={((shareDoc || {}).sharedWith || []).map((s) => s.userId)}
        title={`Share "${(shareDoc || {}).name || ''}"`}
        noteTo="Selected people get a notification and can open the document from their repository."
        onDone={(ids) => share(ids, 'View')}
      />

      {/* edit details */}
      {editDoc && <EditModal doc={editDoc} data={data} onClose={() => setEditDoc(null)} onSave={saveEdit} />}

      <ConfirmDialog
        open={!!confirmDel} onClose={() => setConfirmDel(null)}
        title="Delete document" danger confirmLabel="Delete"
        message={`Delete "${confirmDel ? confirmDel.name : ''}" and all its versions?`}
        onConfirm={deleteDoc}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ upload */
function UploadModal({ onClose, onSave, data }) {
  const [f, setF] = useState({ name: '', file: null, category: 'Report', departmentId: '', description: '', tags: '' })
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  return (
    <Modal
      open onClose={onClose} title="Upload Document"
      sub="Stored with version history in the repository"
      size="md"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!f.file || !f.name.trim()} onClick={() => onSave(f)}>Upload</button>
        </>
      }
    >
      <div className="form-grid">
        <div className="field span-all">
          <label>File <span className="req">*</span></label>
          <input className="input" type="file" onChange={(e) => {
            const file = e.target.files && e.target.files[0]
            if (file) { set('file', file); if (!f.name) set('name', file.name) }
          }} />
          {f.file && <span className="help">{f.file.name} · {fmtBytes(f.file.size)} · {fileKind(f.file.name).toUpperCase()} preview supported</span>}
        </div>
        <div className="field span-all">
          <label>Document name <span className="req">*</span></label>
          <input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="field">
          <label>Category</label>
          <select className="select" value={f.category} onChange={(e) => set('category', e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Department (optional)</label>
          <select className="select" value={f.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
            <option value="">All departments</option>
            {data.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="field span-all">
          <label>Tags (comma separated)</label>
          <input className="input" value={f.tags} onChange={(e) => set('tags', e.target.value)} placeholder="e.g. tender, PWD, FY 2025-26" />
        </div>
        <div className="field span-all">
          <label>Description</label>
          <textarea className="textarea wide" value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="What this document contains and who should use it…" />
        </div>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ version upload */
function VersionModal({ doc, onClose, onSave }) {
  const [note, setNote] = useState('')
  const [file, setFile] = useState(null)
  return (
    <Modal
      open onClose={onClose} title={`Upload New Version`} sub={`${doc.name} — current version v${doc.versions.length}`}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!file} onClick={() => onSave({ note, file })}>Upload v{doc.versions.length + 1}</button>
        </>
      }
    >
      <div className="field">
        <label>File <span className="req">*</span></label>
        <input className="input" type="file" onChange={(e) => setFile(e.target.files && e.target.files[0])} />
        {file && <span className="help">{file.name} · {fmtBytes(file.size)}</span>}
      </div>
      <div className="field mt-2">
        <label>Version note</label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={`e.g. Revised after review comments`} />
      </div>
      <SectionTitle>Version history</SectionTitle>
      <div className="timeline">
        {[...doc.versions].reverse().map((v) => (
          <div key={v.v} className="tl-item">
            <span className="tl-dot" />
            <div className="tl-title">v{v.v} — {v.note}</div>
            <div className="tl-meta">{v.by} · {fmtDateTime(v.uploadedAt)} · {fmtBytes(v.size)}</div>
          </div>
        ))}
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ edit */
function EditModal({ doc, data, onClose, onSave }) {
  const [f, setF] = useState({
    name: doc.name, category: doc.category, departmentId: doc.departmentId || '',
    description: doc.description, tags: doc.tags.join(', ')
  })
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  return (
    <Modal
      open onClose={onClose} title="Edit Document Details" sub={doc.name}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!f.name.trim()} onClick={() => onSave(f)}>Save</button>
        </>
      }
    >
      <div className="form-grid">
        <div className="field span-all">
          <label>Document name <span className="req">*</span></label>
          <input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="field">
          <label>Category</label>
          <select className="select" value={f.category} onChange={(e) => set('category', e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Department</label>
          <select className="select" value={f.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
            <option value="">All departments</option>
            {data.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="field span-all">
          <label>Tags</label>
          <input className="input" value={f.tags} onChange={(e) => set('tags', e.target.value)} />
        </div>
        <div className="field span-all">
          <label>Description</label>
          <textarea className="textarea wide" value={f.description} onChange={(e) => set('description', e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}
