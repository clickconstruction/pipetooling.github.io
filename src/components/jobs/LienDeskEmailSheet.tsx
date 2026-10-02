import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { useEmailPreview } from '../../hooks/useEmailPreview'
import { EmailPreviewOverlay } from './EmailPreviewOverlay'
import { LienShareScopeMenu } from './LienDeskSharePanel'
import { previewFrameHtml } from '../../lib/jobsDocuments/previewFrame'
import { TEAM_EMAIL_FROM_LABEL } from '../../lib/teamEmails'
import { LIEN_SHARE_MAX_RECIPIENTS, lienShareSendLabel, type LienShareScope, type LienShareScopeOption } from '../../lib/jobs/lienDeskShare'
import { fetchLienSharePeople, sendLienStatusEmail, type LienSharePerson } from '../../lib/jobs/lienDeskShareIo'
import { LIEN_STATUS_NOTE_MAX, lienStatusEmailHtml, lienStatusFacts, lienStatusSubject, type LienStatusPayload } from '../../../supabase/functions/_shared/lienDeskStatus'

const PRIMARY = '#2563eb'

/** Where the email comes from and where replies go; outside mail is the user's own (the owner's rule). */
const FROM_WORDS = 'Sends from ClickTooling, and replies come to you. Mail to anyone outside the company goes from your own inbox, so use Send… for that.'

const label: CSSProperties = { padding: '9px 0 9px 18px', color: 'var(--text-muted)', fontSize: '0.8rem' }
const cell: CSSProperties = { padding: '7px 18px 7px 0', fontSize: '0.84rem', minWidth: 0 }
const boxHead: CSSProperties = { fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const plainBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name
}

export type LienDeskEmailSheetProps = {
  isMobile: boolean
  asOfWords: string
  options: readonly LienShareScopeOption[]
  scope: LienShareScope
  onScope: (s: LienShareScope) => void
  payload: LienStatusPayload
  me: { id: string | null; name: string }
  onBack: () => void
  onClose: () => void
  /** The email went out: who got it, and who it could not reach. */
  onSent: (sentTo: string[], failed: string[]) => void
}

/**
 * Email where the liens stand (v2.4311): the team email from the Lien desk's Share. The people
 * who use the desk, a note on top, the email shown as it will arrive, a test to yourself, and
 * the send. `send-lien-desk-summary` renders the same email from the same payload, from
 * ClickTooling, with replies to the sender.
 */
export default function LienDeskEmailSheet(p: LienDeskEmailSheetProps) {
  const { showToast } = useToastContext()
  const { preview, show, close } = useEmailPreview()
  const [people, setPeople] = useState<LienSharePerson[] | null>(null)
  const [peopleError, setPeopleError] = useState<string | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const pickedOnceRef = useRef(false)
  const [subjectTyped, setSubjectTyped] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<'send' | 'test' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const onCloseRef = useRef(p.onClose)
  onCloseRef.current = p.onClose

  useEffect(() => {
    let live = true
    fetchLienSharePeople()
      .then((rows) => {
        if (live) setPeople(rows.filter((r) => r.id !== p.me.id))
      })
      .catch((e: unknown) => {
        if (live) setPeopleError(e instanceof Error ? e.message : 'Could not load the team')
      })
    return () => {
      live = false
    }
  }, [p.me.id])

  // Notices waiting for approval: the leader is who the email is usually for, so he starts picked.
  const waiting = lienStatusFacts(p.payload).waiting.length
  useEffect(() => {
    if (!people || pickedOnceRef.current) return
    pickedOnceRef.current = true
    if (waiting > 0) setPicked(people.filter((x) => x.role === 'master_technician').map((x) => x.id).slice(0, LIEN_SHARE_MAX_RECIPIENTS))
  }, [people, waiting])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || preview) return
      e.preventDefault()
      e.stopPropagation()
      onCloseRef.current()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [preview])

  const subject = subjectTyped ?? lienStatusSubject(p.payload)
  const pickedPeople = useMemo(() => picked.map((id) => people?.find((x) => x.id === id)).filter((x): x is LienSharePerson => Boolean(x)), [picked, people])
  const readerIsLeader = pickedPeople[0]?.role === 'master_technician'
  const html = useMemo(
    () => lienStatusEmailHtml(p.payload, { appUrl: window.location.origin, senderName: p.me.name, note, readerIsLeader }),
    [p.payload, p.me.name, note, readerIsLeader],
  )
  const names = pickedPeople.map((x) => firstName(x.name))

  const toggle = (id: string) => {
    setError(null)
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= LIEN_SHARE_MAX_RECIPIENTS ? cur : [...cur, id]))
  }

  const send = async (mode: 'send' | 'test') => {
    if (busy) return
    if (mode === 'send' && picked.length === 0) {
      setError('Pick someone to send it to.')
      return
    }
    setBusy(mode)
    setError(null)
    try {
      const res = await sendLienStatusEmail({ mode, payload: p.payload, recipientIds: mode === 'send' ? picked : [], subject, note: note.trim() })
      if (mode === 'test') showToast('A test is on its way to you.', 'success')
      else p.onSent(res.sentTo.map(firstName), res.failed.map(firstName))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The email did not send.')
    } finally {
      setBusy(null)
    }
  }

  const card: CSSProperties = p.isMobile
    ? { position: 'fixed', left: 0, right: 0, top: 'var(--app-top-chrome, 0px)', bottom: 'var(--app-bottom-chrome, 0px)', borderRadius: 0 }
    : { position: 'relative', width: 'min(760px, calc(100vw - 2rem))', maxHeight: 'calc(100dvh - 2rem - var(--app-top-chrome, 0px) - var(--app-bottom-chrome, 0px))', borderRadius: 10, boxShadow: '0 20px 40px -12px rgba(0,0,0,0.35)' }

  return (
    <>
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 'var(--app-bottom-chrome, 0px)', paddingTop: 'var(--app-top-chrome, 0px)', zIndex: 740, background: 'rgba(17,24,39,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'left', fontWeight: 400 }} onClick={p.onClose}>
      <div role="dialog" aria-modal="true" aria-label="Email where the liens stand" data-lien-share-email-sheet onClick={(e) => e.stopPropagation()} style={{ ...card, display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr) auto', gridTemplateColumns: 'minmax(0, 1fr)', overflow: 'hidden', background: 'var(--surface)', color: 'var(--text-base)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '12px 18px 10px', borderBottom: '1px solid var(--border)' }}>
          <button type="button" onClick={p.onBack} style={{ border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.8rem', fontWeight: 600, padding: 0, whiteSpace: 'nowrap' }}>
            ‹ Back
          </button>
          <strong style={{ fontSize: '0.98rem', minWidth: 0 }}>Email where the liens stand</strong>
          {p.isMobile ? null : <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>as of {p.asOfWords}</span>}
          <button type="button" onClick={p.onClose} aria-label="Close" style={{ marginLeft: 'auto', border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1, padding: 0 }}>
            ×
          </button>
        </div>

        <div style={{ overflowY: 'auto', minHeight: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '78px minmax(0, 1fr)', borderBottom: '1px solid var(--border)' }}>
            <div style={label}>From</div>
            <div style={{ ...cell, padding: '9px 18px 9px 0', color: 'var(--text-700)', overflowWrap: 'anywhere' }}>{TEAM_EMAIL_FROM_LABEL}</div>

            <div style={{ ...label, borderTop: '1px solid var(--border)' }}>To</div>
            <div style={{ ...cell, borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }} data-lien-share-people>
              {people == null && !peopleError ? <span style={{ color: 'var(--text-muted)' }}>Loading the team…</span> : null}
              {peopleError ? <span style={{ color: 'var(--text-red-600)' }}>{peopleError}</span> : null}
              {people?.map((x) => {
                const on = picked.includes(x.id)
                const full = !on && picked.length >= LIEN_SHARE_MAX_RECIPIENTS
                return (
                  <button
                    key={x.id}
                    type="button"
                    aria-pressed={on}
                    disabled={full}
                    onClick={() => toggle(x.id)}
                    title={x.email}
                    data-lien-share-person={x.id}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, minHeight: p.isMobile ? 40 : undefined, padding: '4px 11px', borderRadius: 999, border: `1px solid ${on ? PRIMARY : 'var(--border-strong)'}`, background: on ? PRIMARY : 'var(--surface)', color: on ? '#fff' : 'var(--text-700)', font: 'inherit', fontSize: '0.8rem', fontWeight: 600, cursor: full ? 'default' : 'pointer', opacity: full ? 0.5 : 1 }}
                  >
                    {on ? '✓ ' : ''}
                    {x.name}
                    {x.role === 'master_technician' ? <span style={{ fontWeight: 500, opacity: 0.85 }}>· approves</span> : null}
                  </button>
                )
              })}
              {people && people.length === 0 ? <span style={{ color: 'var(--text-muted)' }}>No one else on the desk has an email on file.</span> : null}
            </div>

            <div style={{ ...label, borderTop: '1px solid var(--border)' }}>Reply to</div>
            <div style={{ ...cell, padding: '9px 18px 9px 0', borderTop: '1px solid var(--border)', color: 'var(--text-700)' }}>
              {p.me.name} <span style={{ color: 'var(--text-muted)' }}>(you)</span>
            </div>

            <div style={{ ...label, borderTop: '1px solid var(--border)' }}>
              <label htmlFor="lien-share-subject">Subject</label>
            </div>
            <div style={{ ...cell, borderTop: '1px solid var(--border)' }}>
              <input id="lien-share-subject" type="text" value={subject} maxLength={200} onChange={(e) => setSubjectTyped(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-base)', font: 'inherit', fontSize: '0.84rem' }} />
            </div>
          </div>

          <div style={{ padding: '12px 18px 0', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 4 }}>
              <div style={boxHead}>What to send</div>
              <LienShareScopeMenu options={p.options} value={p.scope} onChange={(s) => { setSubjectTyped(null); p.onScope(s) }} big={p.isMobile} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 4 }}>
              <label htmlFor="lien-share-note" style={boxHead}>
                A note on top · optional
              </label>
              <textarea id="lien-share-note" rows={2} maxLength={LIEN_STATUS_NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} placeholder={names.length === 1 ? `A line for ${names[0]}` : 'A line for the people you pick'} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-base)', font: 'inherit', fontSize: '0.84rem', resize: 'vertical' }} />
              {note.length > LIEN_STATUS_NOTE_MAX - 40 ? <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right' }}>{note.length} / {LIEN_STATUS_NOTE_MAX}</div> : null}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 4, paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <span style={boxHead}>The email</span>
                <button type="button" onClick={() => void show(subject, html)} data-lien-share-preview-email style={{ marginLeft: 'auto', border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.8rem', fontWeight: 600, padding: 0 }}>
                  Preview the whole email ›
                </button>
              </div>
              <iframe
                title="The email, as it will arrive"
                sandbox="allow-same-origin"
                srcDoc={previewFrameHtml(html)}
                style={{ width: '100%', height: p.isMobile ? 220 : 260, border: '1px solid var(--border)', borderRadius: 9, background: 'var(--bg-page)', display: 'block' }}
              />
              {p.isMobile ? <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4, marginTop: 6 }}>{FROM_WORDS}</div> : null}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: '12px 18px 14px', borderTop: '1px solid var(--border)' }}>
          {error ? (
            <div role="alert" style={{ flexBasis: '100%', fontSize: '0.8rem', color: 'var(--text-red-600)' }}>
              {error}
            </div>
          ) : null}
          {p.isMobile ? null : <span style={{ flex: '1 1 260px', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{FROM_WORDS}</span>}
          <button type="button" onClick={() => void send('test')} disabled={busy != null} data-lien-share-test style={{ ...plainBtn, opacity: busy ? 0.6 : 1, minHeight: p.isMobile ? 44 : undefined }}>
            {busy === 'test' ? 'Sending…' : 'Email me a test'}
          </button>
          <button type="button" onClick={() => void send('send')} disabled={busy != null || picked.length === 0} data-lien-share-send-email title={picked.length === 0 ? 'Pick someone to send it to' : undefined} style={{ ...plainBtn, border: '1px solid transparent', background: PRIMARY, color: '#fff', opacity: busy || picked.length === 0 ? 0.55 : 1, cursor: busy || picked.length === 0 ? 'default' : 'pointer', minHeight: p.isMobile ? 44 : undefined }}>
            {busy === 'send' ? 'Sending…' : lienShareSendLabel(names)}
          </button>
        </div>
      </div>
    </div>
    {preview ? <EmailPreviewOverlay preview={preview} onClose={close} /> : null}
    </>
  )
}
