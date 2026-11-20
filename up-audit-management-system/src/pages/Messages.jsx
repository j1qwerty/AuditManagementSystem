// Internal messaging (FR-050, FR-052, FR-053): two-pane inbox with threads,
// cross-tab real-time delivery and optional simulated email copies.
import { useMemo, useState, useEffect, useRef } from 'react'
import { useData } from '../context/DataContext'
import { Avatar, Empty, Modal } from '../components/ui'
import { fmtDateTime, fmtRelative, uid, todayISO, groupBy } from '../lib/utils'
import config from '../lib/config'

export default function Messages() {
  const { data, currentUser, save, toast, sendEmail, logActivity } = useData()
  const [activeThread, setActiveThread] = useState(null)
  const [reply, setReply] = useState('')
  const [composeOpen, setComposeOpen] = useState(false)
  const [alsoEmail, setAlsoEmail] = useState(true)
  const bottomRef = useRef(null)

  const threads = useMemo(() => {
    const mine = data.messages.filter((m) => m.from === currentUser.id || (m.to || []).includes(currentUser.id))
    const g = groupBy(mine, (m) => m.threadId)
    return Object.entries(g)
      .map(([threadId, msgs]) => {
        const sorted = msgs.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        const last = sorted[sorted.length - 1]
        const participants = Array.from(new Set(sorted.flatMap((m) => [m.from, ...(m.to || [])])))
        const unread = sorted.filter((m) => m.from !== currentUser.id && !(m.readBy || []).includes(currentUser.id)).length
        return { threadId, subject: last.subject, messages: sorted, last, participants, unread }
      })
      .sort((a, b) => new Date(b.last.timestamp) - new Date(a.last.timestamp))
  }, [data.messages, currentUser])

  const active = threads.find((t) => t.threadId === activeThread)

  // mark thread as read
  useEffect(() => {
    if (!active) return
    const unreadMsgs = active.messages.filter((m) => m.from !== currentUser.id && !(m.readBy || []).includes(currentUser.id))
    unreadMsgs.forEach(async (m) => {
      await idbMarkRead(m)
    })
    async function idbMarkRead(m) {
      const updated = { ...m, readBy: [...(m.readBy || []), currentUser.id] }
      await save('messages', updated)
    }
  }, [activeThread, data.messages])

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ block: 'nearest' })
  }, [active && active.messages.length])

  const send = async () => {
    if (!reply.trim() || !active) return
    const msg = {
      id: uid('m'),
      threadId: active.threadId,
      from: currentUser.id,
      fromName: currentUser.name,
      to: active.participants.filter((p) => p !== currentUser.id),
      subject: active.subject,
      body: reply.trim(),
      timestamp: todayISO(),
      readBy: [currentUser.id]
    }
    await save('messages', msg, { logAction: 'Sent message', logDetail: `Re: ${active.subject}` })
    if (alsoEmail && config.emailSimulation) {
      for (const p of msg.to) {
        const u = data.users.find((x) => x.id === p)
        if (u) await sendEmail(u.email, `[AMS] Re: ${active.subject}`, reply.trim().slice(0, 200))
      }
    }
    setReply('')
    toast('Message sent — delivered instantly to open tabs of the recipients.')
  }

  const userById = (id) => data.users.find((u) => u.id === id) || {}

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Messages</h1>
          <div className="sub">Internal messaging between audit teams, reviewers and department coordinators — with simulated email copies (FR-050, FR-052).</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setComposeOpen(true)}>✎ New message</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
        <div className="card" style={{ maxHeight: 640, overflowY: 'auto' }}>
          {threads.length === 0 && <div className="card-body"><Empty icon="✉" title="No conversations yet" /></div>}
          {threads.map((t) => (
            <div
              key={t.threadId}
              onClick={() => setActiveThread(t.threadId)}
              style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: activeThread === t.threadId ? 'var(--primary-soft)' : 'transparent' }}
            >
              <div className="flex-between">
                <b style={{ fontSize: 13 }}>{t.subject.length > 34 ? t.subject.slice(0, 34) + '…' : t.subject}</b>
                {t.unread > 0 && <span className="badge success" style={{ background: 'var(--primary)', color: '#fff', border: 'none' }}>{t.unread}</span>}
              </div>
              <div className="muted small" style={{ marginTop: 3 }}>
                {t.messages[t.messages.length - 1].fromName.split(' ')[0]}: {t.messages[t.messages.length - 1].body.slice(0, 44)}…
              </div>
              <div className="muted small" style={{ marginTop: 2, fontSize: 11 }}>{t.participants.length} participants · {fmtRelative(t.last.timestamp)}</div>
            </div>
          ))}
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', maxHeight: 640 }}>
          {!active ? (
            <div className="card-body" style={{ margin: 'auto' }}>
              <Empty icon="✉" title="Select a conversation" sub="Pick a thread on the left to read and reply." />
            </div>
          ) : (
            <>
              <div className="card-head">
                <div>
                  <h3>{active.subject}</h3>
                  <div className="hint" style={{ marginTop: 2 }}>
                    {active.participants.map((p) => userById(p).name).filter(Boolean).join(', ')}
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                {active.messages.map((m) => {
                  const mine = m.from === currentUser.id
                  return (
                    <div key={m.id} className="flex" style={{ alignItems: 'flex-start', marginBottom: 14, gap: 10, flexDirection: mine ? 'row-reverse' : 'row' }}>
                      <Avatar name={m.fromName} color={userById(m.from).avatarColor} />
                      <div style={{ maxWidth: '72%', background: mine ? 'var(--primary-soft)' : 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 13px' }}>
                        <div className="small" style={{ fontWeight: 700 }}>{m.fromName} <span className="muted" style={{ fontWeight: 400 }}>· {fmtDateTime(m.timestamp)}</span></div>
                        <div className="small" style={{ marginTop: 4, lineHeight: 1.55 }}>{m.body}</div>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>
              <div style={{ borderTop: '1px solid var(--border)', padding: 12 }}>
                <textarea className="textarea" style={{ minHeight: 64 }} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type your reply…" />
                <div className="flex-between mt-1">
                  <label className="checkbox-row small">
                    <input type="checkbox" checked={alsoEmail} onChange={(e) => setAlsoEmail(e.target.checked)} />
                    Also send email copy (simulated)
                  </label>
                  <button className="btn btn-primary" onClick={send}>Send reply</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Compose open={composeOpen} onClose={() => setComposeOpen(false)} />
    </div>
  )

  function Compose({ open, onClose }) {
    const [form, setForm] = useState({ to: [], subject: '', body: '' })
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
    const submit = async () => {
      if (!form.to.length || !form.subject.trim() || !form.body.trim()) { toast('Add recipient, subject and message.', 'error'); return }
      const threadId = uid('th')
      const msg = {
        id: uid('m'), threadId, from: currentUser.id, fromName: currentUser.name,
        to: form.to, subject: form.subject, body: form.body, timestamp: todayISO(), readBy: [currentUser.id]
      }
      await save('messages', msg, { logAction: 'Sent message', logDetail: form.subject })
      if (config.emailSimulation) {
        for (const p of form.to) {
          const u = data.users.find((x) => x.id === p)
          if (u) await sendEmail(u.email, `[AMS] ${form.subject}`, form.body.slice(0, 200))
        }
      }
      toast('Message sent.')
      setForm({ to: [], subject: '', body: '' })
      onClose()
      setActiveThread(threadId)
    }
    return (
      <Modal open={open} onClose={onClose} title="New message"
        footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={submit}>Send</button></>}>
        <div className="field"><label>To</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {data.users.filter((u) => u.id !== currentUser.id).map((u) => {
              const checked = form.to.includes(u.id)
              return (
                <label key={u.id} style={{ border: `1px solid ${checked ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
                  <span className="checkbox-row" style={{ padding: 0 }}>
                    <input type="checkbox" checked={checked} onChange={() => set('to', checked ? form.to.filter((x) => x !== u.id) : [...form.to, u.id])} />
                    <span className="small">{u.name}</span>
                  </span>
                </label>
              )
            })}
          </div></div>
        <div className="field"><label>Subject</label>
          <input className="input" value={form.subject} onChange={(e) => set('subject', e.target.value)} /></div>
        <div className="field"><label>Message</label>
          <textarea className="textarea" style={{ minHeight: 100 }} value={form.body} onChange={(e) => set('body', e.target.value)} /></div>
      </Modal>
    )
  }
}
