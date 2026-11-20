// Messages - internal messaging with direct and group conversations.
// The left panel lists conversations (tabs: All / Direct / Groups); the right
// panel is the chat. New conversations pick people via search + filters.
import { useMemo, useState, useEffect, useRef } from 'react'
import { useData } from '../context/DataContext'
import { PageHead, Tabs, Avatar, AvatarStack, Empty, Modal, UserPicker, Badge } from '../components/ui'
import { navigate } from '../lib/router'
import { fmtRelative, fmtDateTime, uid, groupBy } from '../lib/utils'
import { ROLES } from '../lib/permissions'

export default function Messages() {
  const { data, save, notify, currentUser, unreadThreads, toast, can } = useData()
  const [tab, setTab] = useState('all')
  const [activeThread, setActiveThread] = useState(null)
  const [q, setQ] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [reply, setReply] = useState('')
  const chatEndRef = useRef(null)

  // ---- conversations from the flat message list ----
  const conversations = useMemo(() => {
    const byThread = groupBy(data.messages, (m) => m.threadId)
    return Object.entries(byThread).map(([threadId, msgs]) => {
      msgs = [...msgs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      const participants = Array.from(new Set(msgs.flatMap((m) => [m.from, ...(m.to || [])])))
      const others = participants.filter((p) => p !== currentUser.id)
      const last = msgs[msgs.length - 1]
      const isGroup = participants.length > 2
      const otherUsers = others.map((id) => data.users.find((u) => u.id === id)).filter(Boolean)
      const subject = last.subject || ''
      return {
        id: threadId, msgs, participants, others, otherUsers, isGroup, subject,
        last, unread: unreadThreads.has(threadId),
        title: isGroup ? (subject || 'Group conversation') : (otherUsers[0] ? otherUsers[0].name : subject),
        preview: last.body
      }
    }).sort((a, b) => new Date(b.last.timestamp) - new Date(a.last.timestamp))
  }, [data.messages, data.users, currentUser, unreadThreads])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return conversations
      .filter((c) => tab === 'all' || (tab === 'direct' ? !c.isGroup : c.isGroup))
      .filter((c) => !s || c.title.toLowerCase().includes(s) || c.subject.toLowerCase().includes(s) ||
        c.otherUsers.some((u) => u.name.toLowerCase().includes(s)) ||
        c.msgs.some((m) => m.body.toLowerCase().includes(s)))
  }, [conversations, tab, q])

  const active = conversations.find((c) => c.id === activeThread) || filtered[0] || null

  // mark thread read when opened
  useEffect(() => {
    if (!active) return
    const unread = active.msgs.filter((m) => (m.to || []).includes(currentUser.id) && !(m.readBy || []).includes(currentUser.id))
    unread.forEach(async (m) => {
      await save('messages', { ...m, readBy: [...(m.readBy || []), currentUser.id] }, { log: false })
    })
  }, [activeThread, active && active.id])

  useEffect(() => {
    chatEndRef.current && chatEndRef.current.scrollIntoView({ block: 'end' })
  }, [active && active.msgs.length])

  const send = async () => {
    if (!reply.trim() || !active) return
    const msg = {
      id: uid('m'), threadId: active.id, from: currentUser.id, fromName: currentUser.name,
      to: active.others, subject: active.subject, body: reply.trim(),
      timestamp: new Date().toISOString(), readBy: [currentUser.id]
    }
    await save('messages', msg, { logAction: 'Sent message', logDetail: `To: ${active.title}` })
    await notify(active.others, 'Message', `New message from ${currentUser.name}`, reply.trim().slice(0, 80), '#/messages')
    setReply('')
  }

  const startConversation = async ({ participantIds, subject }) => {
    // reuse existing direct thread if one exists
    if (participantIds.length === 1) {
      const existing = conversations.find((c) => !c.isGroup && c.others.length === 1 && c.others[0] === participantIds[0])
      if (existing) { setActiveThread(existing.id); return existing }
    }
    const threadId = uid('th')
    const msg = {
      id: uid('m'), threadId, from: currentUser.id, fromName: currentUser.name,
      to: participantIds, subject: subject || (participantIds.length > 1 ? 'Group conversation' : 'Conversation'),
      body: `Conversation started by ${currentUser.name}.`, timestamp: new Date().toISOString(),
      readBy: [currentUser.id]
    }
    await save('messages', msg, { logAction: 'Started conversation', logDetail: `With ${participantIds.length} participant(s)` })
    await notify(participantIds, 'Message', `${currentUser.name} started a conversation with you`, msg.subject, '#/messages')
    setActiveThread(threadId)
    toast('Conversation started')
  }

  const roleOf = (id) => {
    const u = data.users.find((x) => x.id === id)
    return u ? ROLES[u.role].label : ''
  }

  return (
    <div>
      <PageHead
        title="Messages"
        sub="Direct and group conversations with audit teams and coordinators"
        actions={can('message.send') ? <button className="btn btn-primary" onClick={() => setNewOpen(true)}>+ New Message</button> : null}
      />

      <div className="chat-layout">
        {/* ---------------- conversation list ---------------- */}
        <div className="convo-list">
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
            <input className="input" placeholder="Search conversations…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Tabs
            tabs={[
              { key: 'all', label: 'All', count: conversations.length },
              { key: 'direct', label: 'Direct', count: conversations.filter((c) => !c.isGroup).length },
              { key: 'group', label: 'Groups', count: conversations.filter((c) => c.isGroup).length }
            ]}
            active={tab} onChange={setTab}
          />
          <div className="scroll-y" style={{ flex: 1 }}>
            {filtered.length === 0 && <Empty icon="✉" title="No conversations" sub="Start a new message to begin." />}
            {filtered.map((c) => (
              <div key={c.id} className={`convo-item ${active && active.id === c.id ? 'active' : ''}`} onClick={() => setActiveThread(c.id)}>
                {c.isGroup ? (
                  <span style={{ position: 'relative', flexShrink: 0 }}>
                    <AvatarStack people={c.otherUsers.slice(0, 3).map((u) => ({ name: u.name, color: u.avatarColor }))} />
                  </span>
                ) : (
                  <Avatar name={c.otherUsers[0] ? c.otherUsers[0].name : '?'} color={c.otherUsers[0] ? c.otherUsers[0].avatarColor : undefined} />
                )}
                <div className="ci-main">
                  <div className="ci-top">
                    <span className="ci-name" style={c.isGroup ? { color: 'var(--thistle-700)' } : undefined}>
                      {c.isGroup ? '👥 ' : ''}{c.title}
                    </span>
                    <span className="ci-time">{fmtRelative(c.last.timestamp)}</span>
                  </div>
                  <div className="ci-preview">{c.last.fromName.split(' ')[0]}: {c.preview}</div>
                </div>
                {c.unread && <span style={{ width: 9, height: 9, borderRadius: 5, background: 'var(--petal-500)', flexShrink: 0, marginTop: 6 }} />}
              </div>
            ))}
          </div>
        </div>

        {/* ---------------- chat panel ---------------- */}
        {active ? (
          <div className="chat-panel">
            <div className="chat-head">
              {active.isGroup ? (
                <AvatarStack people={active.otherUsers.map((u) => ({ name: u.name, color: u.avatarColor }))} />
              ) : (
                <Avatar name={active.otherUsers[0] ? active.otherUsers[0].name : '?'} color={active.otherUsers[0] ? active.otherUsers[0].avatarColor : undefined} lg />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="bold" style={{ fontSize: 14.5 }}>
                  {active.isGroup ? '👥 ' : ''}{active.title}
                  {active.isGroup && <span className="badge purple" style={{ marginLeft: 8 }}>group</span>}
                </div>
                <div className="muted small ellipsis" title={active.subject}>
                  {active.isGroup
                    ? active.otherUsers.map((u) => u.name).join(', ')
                    : `${active.otherUsers[0] ? roleOf(active.others[0]) : ''}${active.otherUsers[0] && active.otherUsers[0].departmentId ? ' · ' + (data.departments.find((d) => d.id === active.otherUsers[0].departmentId) || {}).name : ''}`}
                  {active.subject ? ` · ${active.subject}` : ''}
                </div>
              </div>
              {active.otherUsers.map((u) => (
                <button key={u.id} className="user-chip" style={{ padding: '2px 6px 2px 2px' }} title={`Open ${u.name}'s activity`} onClick={() => navigate('/activity')}>
                  <Avatar name={u.name} color={u.avatarColor} sm />
                </button>
              ))}
            </div>
            <div className="chat-body scroll-y">
              {active.msgs.map((m) => {
                const mine = m.from === currentUser.id
                const sender = data.users.find((u) => u.id === m.from)
                return (
                  <div key={m.id} className={`chat-msg ${mine ? 'mine' : ''}`}>
                    {!mine && <Avatar name={m.fromName} color={sender ? sender.avatarColor : undefined} />}
                    <div className="cm-body">
                      {!mine && <div className="cm-sender">{m.fromName}{sender ? ` · ${ROLES[sender.role].label}` : ''}</div>}
                      <div className="cm-text">{m.body}</div>
                      <div className="cm-time" title={fmtDateTime(m.timestamp)}>{fmtRelative(m.timestamp)}</div>
                    </div>
                  </div>
                )
              })}
              <div ref={chatEndRef} />
            </div>
            {can('message.send') && (
              <div className="chat-foot">
                <input
                  className="input" style={{ flex: 1 }}
                  placeholder={`Message ${active.isGroup ? 'the group' : active.title.split(' ')[0]}…`}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && send()}
                />
                <button className="btn btn-primary" disabled={!reply.trim()} onClick={send}>Send</button>
              </div>
            )}
          </div>
        ) : (
          <div className="chat-panel">
            <Empty icon="✉" title="Select a conversation" sub="Or start a new message from the button above." />
          </div>
        )}
      </div>

      {/* new message */}
      {newOpen && (
        <NewMessageModal
          data={data}
          currentUser={currentUser}
          onClose={() => setNewOpen(false)}
          onStart={startConversation}
        />
      )}
    </div>
  )
}

function NewMessageModal({ data, currentUser, onClose, onStart }) {
  const [picked, setPicked] = useState([])
  const [subject, setSubject] = useState('')
  const [showPicker, setShowPicker] = useState(true)
  const userName = (id) => (data.users.find((u) => u.id === id) || {}).name
  const isGroup = picked.length > 1

  return (
    <Modal
      open onClose={onClose} title="New Message" sub={isGroup ? 'This will start a group conversation' : 'Pick one or more people'}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={picked.length === 0}
            onClick={() => { onStart({ participantIds: picked, subject: subject.trim() }); onClose() }}
          >
            Start {isGroup ? 'Group' : 'Conversation'}
          </button>
        </>
      }
    >
      <div className="field mb-2">
        <label>Subject</label>
        <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. HFW audit — records request" />
      </div>
      <div className="field">
        <label>To ({picked.length} selected) <span className="req">*</span></label>
        {picked.length > 0 && (
          <div className="flex wrap mb-2" style={{ gap: 6 }}>
            {picked.map((id) => {
              const u = data.users.find((x) => x.id === id)
              return (
                <span key={id} className="chip active" onClick={() => setPicked(picked.filter((x) => x !== id))}>
                  <Avatar name={u.name} color={u.avatarColor} sm /> {u.name} ✕
                </span>
              )
            })}
          </div>
        )}
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowPicker(true)}>+ Choose people</button>
        <span className="help mt-1" style={{ display: 'block' }}>
          {isGroup ? `${picked.length} people will form a group conversation.` : 'Search by name, filter by role or department.'}
        </span>
      </div>

      <UserPicker
        open={showPicker} onClose={() => setShowPicker(false)}
        users={data.users.filter((u) => u.id !== currentUser.id)}
        multi initialSelected={picked}
        title="Choose recipients"
        noteTo="Select one person for a direct chat, or several to create a group conversation."
        onDone={(ids) => setPicked(ids)}
      />
    </Modal>
  )
}
