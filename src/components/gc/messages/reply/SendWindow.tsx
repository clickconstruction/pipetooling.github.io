import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useToastContext } from '../../../../contexts/ToastContext'
import { pressProblem } from '../../../../lib/followUp/followUpIo'
import { afterSendDefault, afterSendResult, afterSendTips, afterSendWords, dayKept, owedMarkedToast, readDay, type AfterSendMove } from '../../../../lib/messages/owed'
import { todayYmdInAppTz } from '../../../../utils/dateUtils'
import { useOwedAfterSend, useThreadOwed } from '../../../followUp/useThreadOwed'
import { buildPlainMessagesEmail } from '../../../../../supabase/functions/_shared/messagesEmail'
import { firstName, type Contact } from '../../../../lib/contacts/kernel'
import {
  canSend,
  daysSinceOurLastText,
  emailDraft,
  emailRepliesNote,
  EMAIL_SOURCES_NOTE,
  fromHeader,
  OWN_MAILBOX_GUIDE_HREF,
  ownMailboxNote,
  replyToHeader,
  optoutBubble,
  optoutHoldNote,
  OPTOUT_HOLD_TIP,
  optoutReason,
  replyRecipient,
  sendWarnings,
  sentCopyNote,
  SUBJECT_BLANK,
  TEXT_FROM_NOTE,
  textToSend,
  type ComposeCompany,
  type ComposeSender,
} from '../../../../lib/messages/compose'
import { lastOurTextAt, priorTexts } from '../../../../lib/messages/replyBox'
import type { ReplyIo } from '../../../../lib/messages/replyIo'
import { TextsWaitLine } from './TextsWaitLine'
import type { AttachIo } from '../../../../lib/messages/attachIo'
import type { DeviceBytes } from '../../../../lib/documents/emailFileAsks'
import { chipFacts, emailFileNote, textFileNote, type Audience } from '../../../../lib/documents/outgoing'
import { replyFileAsks, replyWays, wordsMakers, type ReplyFile } from '../../../../lib/messages/replyFiles'
import { formatErrorMessage } from '../../../../utils/errorHandling'
import { Btn, input } from '../../gcUi'
import { useOpenThread } from '../openThread'
import { useTextsOn } from './useTextsOn'

type Kind = 'text' | 'email'

const note = { fontSize: '0.8rem', color: 'var(--text-600)', margin: 0 } as const
const warn = { fontSize: '0.8rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', borderRadius: 6, padding: '0.35rem 0.55rem' } as const

/**
 * Messages, cut 3's screens: the send window, opened from the reply box's Send. Before anything goes it shows the
 * message the way they will see it: an email as their inbox opens it, plain since punch list #207 PR 1 (the email
 * `messages-email` sends, built by the same `buildPlainMessagesEmail`), or a text on their phone under the texts already there, with the
 * opt-out line as the app's own bubble when a rule puts it on. The subject can be changed for this one email. Email and
 * Text switch here too. Nothing goes until *Send as …*; while Send texts is off, a text says it waits.
 */
export function SendWindow({
  contact,
  kind,
  body,
  jobKey,
  company,
  io,
  files = [],
  audience = 'unknown',
  hasPortal = false,
  attachIo,
  onKind,
  onClose,
  onSent,
}: {
  contact: Contact
  kind: Kind
  body: string
  jobKey: string | null
  company: ComposeCompany
  io: ReplyIo
  /** The files on it (cut 7f), each shown with how it goes. */
  files?: readonly ReplyFile[]
  audience?: Audience
  /** A link to their portal is on: a file with a page there goes as their portal at it. */
  hasPortal?: boolean
  /** Reads a file from this computer for the send. */
  attachIo?: Pick<AttachIo, 'readDevice'>
  onKind: (kind: Kind) => void
  onClose: () => void
  /** It went: the toast's second sentence, when what we owe changed with it. */
  onSent: (kind: Kind, more?: string | null) => void
}) {
  const open = useOpenThread()
  const to = useMemo(() => replyRecipient(contact), [contact])
  const now = Date.parse(open?.nowIso ?? '') || Date.now()
  const jobName = jobKey ? (open?.tiles[jobKey]?.name ?? null) : null
  const [sender, setSender] = useState<ComposeSender | null>(null)
  const [typedSubject, setTypedSubject] = useState<string | null>(null)
  const [editingSubject, setEditingSubject] = useState<string | null>(null)
  const [held, setHeld] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  // Cut 2's *After this sends*: whose move it is once this goes, read with the thread (`useThreadOwed`).
  const { showToast } = useToastContext()
  const { owed, loaded } = useThreadOwed(contact.id)
  const afterSend = useOwedAfterSend(contact.id)
  const [move, setMove] = useState<AfterSendMove | null>(null)
  const [oweWhat, setOweWhat] = useState('')
  const [oweWhen, setOweWhen] = useState('')
  const today = todayYmdInAppTz()
  const shownMove = move ?? afterSendDefault(owed)
  const moveWords = afterSendWords(owed, shownMove)
  const moveTips = afterSendTips(owed)
  const whenRead = readDay(oweWhen, today)

  useEffect(() => {
    let live = true
    io.loadSender()
      .then((s) => live && setSender(s))
      .catch(() => live && setSender({ name: '' }))
    return () => {
      live = false
    }
  }, [io])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault()
        if (editingSubject !== null) setEditingSubject(null)
        else if (!busy) onClose()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose, busy, editingSubject])

  const greetingName = contact.kind === 'unknown' ? '' : firstName(contact)
  const draft = emailDraft({ company, sender: sender ?? { name: '' }, to, jobName, body, typedSubject })
  const ownMailbox = ownMailboxNote(company)
  const email = buildPlainMessagesEmail(draft)

  const lastText = lastOurTextAt(open?.lines ?? [], to.numberChannelId)
  const reason = optoutReason(lastText, now)
  const days = daysSinceOurLastText(lastText, now)
  const text = textToSend({ body, reason, held, company })
  const bubble = text.withLine && reason ? optoutBubble(reason, days, company) : null
  const hold = optoutHoldNote(reason, held, days, greetingName || contact.name)
  const prior = priorTexts(open?.lines ?? [], to.numberChannelId)
  const warnings = sendWarnings(kind, to, kind === 'text' ? text : undefined)
  const ways = replyWays(files, kind)
  const makers = wordsMakers(hasPortal)
  const fileNote = kind === 'email' ? emailFileNote(ways, audience, makers) : textFileNote(ways)
  const textsOn = useTextsOn()
  const waits = kind === 'text' && !textsOn
  const goes = canSend(kind, to) && !waits && (kind === 'text' || sender !== null)

  const send = async () => {
    setBusy(true)
    setProblem(null)
    try {
      let messageId: string
      if (kind === 'email') {
        if (!to.emailChannelId) return
        // A file from this computer is read now, for the function to put into the job's Team only on the way out.
        const bytes = new Map<string, DeviceBytes>()
        for (const f of files) {
          if (f.device && attachIo) bytes.set(f.draft.key, await attachIo.readDevice(f.device))
        }
        const asks = replyFileAsks(files, audience, hasPortal, bytes)
        if (!asks.ok) {
          setProblem(asks.words)
          return
        }
        messageId = await io.sendEmail({ contactId: contact.id, channelId: to.emailChannelId, jobKey, draft, ...(asks.asks.length ? { files: asks.asks } : {}) })
      } else {
        if (!to.numberChannelId) return
        messageId = await io.sendText({ contactId: contact.id, channelId: to.numberChannelId, jobKey, body, held })
      }
      // It went. What we owe follows the press under the message; a refusal there is said, and the message stays sent.
      let more: string | null = null
      const result = loaded ? afterSendResult(owed, shownMove, { what: oweWhat }) : 'none'
      try {
        if (result === 'done') {
          await afterSend.sentDone(messageId)
          more = 'It is done.'
        } else if (result === 'mark') {
          await afterSend.mark(oweWhat.trim(), dayKept(readDay(oweWhen, today)))
          more = owedMarkedToast(greetingName || contact.name, { what: oweWhat.trim() })
        }
      } catch (e) {
        showToast(pressProblem(e), 'error')
      }
      onSent(kind, more)
    } catch (e) {
      setProblem(formatErrorMessage(e, kind === 'email' ? 'The email did not go.' : 'The text did not go.'))
    } finally {
      setBusy(false)
    }
  }

  const saveSubject = () => {
    const v = (editingSubject ?? '').trim()
    if (!v) {
      setProblem(SUBJECT_BLANK)
      return
    }
    setProblem(null)
    setTypedSubject(v)
    setEditingSubject(null)
  }

  const tab = (k: Kind, label: string) => (
    <button
      key={k}
      type="button"
      role="tab"
      aria-selected={kind === k}
      onClick={() => {
        setProblem(null)
        onKind(k)
      }}
      style={{
        border: '1px solid var(--border)',
        borderBottom: kind === k ? '2px solid var(--text-blue-700)' : '1px solid var(--border)',
        background: kind === k ? 'var(--surface)' : 'var(--bg-subtle)',
        borderRadius: '6px 6px 0 0',
        padding: '0.3rem 0.8rem',
        fontWeight: kind === k ? 600 : 400,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )

  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
        if (!busy) onClose()
      }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.35)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(0.75rem + var(--app-top-chrome, 0px)) 0.75rem 0.75rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Before it goes, this is what they see"
        data-send-window={kind}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 10, width: 'min(720px, 100%)', maxHeight: 'min(92vh, 100%)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-strong)' }}
      >
        <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Before it goes, this is what they see</h2>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}>
            ×
          </button>
        </div>

        <div style={{ padding: '0.8rem 1rem', overflowY: 'auto', display: 'grid', gap: '0.6rem', fontSize: '0.875rem' }}>
          <div role="tablist" aria-label="Send as" style={{ display: 'flex', gap: '0.3rem' }}>
            {tab('email', 'Email')}
            {tab('text', 'Text')}
          </div>

          {kind === 'email' ? (
            <>
              <p style={note}>What {contact.name} sees in their inbox, then opened.</p>
              <div data-send-head style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.7rem', display: 'grid', gap: '0.2rem', fontSize: '0.82rem' }}>
                <div>
                  <strong>From:</strong> {fromHeader(company)}
                </div>
                {replyToHeader(company) && (
                  <div data-send-reply-to>
                    <strong>Replies to:</strong> {replyToHeader(company)}
                  </div>
                )}
                <div>
                  <strong>To:</strong> {contact.name} {to.email ? `<${to.email}>` : <em style={{ color: 'var(--text-muted)' }}>no email on file</em>}
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong>Subject:</strong>
                  {editingSubject === null ? (
                    <>
                      <span data-send-subject>{draft.subject}</span>
                      <button
                        type="button"
                        title="For this email only. The app made it from the job and your first line. Your words replace it here and nowhere else."
                        onClick={() => setEditingSubject(draft.subject)}
                        style={{ border: 'none', background: 'transparent', color: 'var(--text-blue-700)', cursor: 'pointer', fontSize: '0.8rem' }}
                      >
                        change
                      </button>
                    </>
                  ) : (
                    <>
                      <input
                        aria-label="Subject"
                        value={editingSubject}
                        autoFocus
                        onChange={(e) => setEditingSubject(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveSubject()
                        }}
                        style={{ ...input, minWidth: 260, flex: 1 }}
                      />
                      <Btn kind="primary" onClick={saveSubject}>
                        Save
                      </Btn>
                      <Btn onClick={() => setEditingSubject(null)}>Cancel</Btn>
                    </>
                  )}
                </div>
              </div>
              {/* Ours, not what they see, so under the head and not in it (punch list #230 PR 0): an answer from a
                  person's own mailbox reaches this thread only when the box is copied. */}
              <p data-send-own-mailbox style={{ ...note, color: 'var(--text-muted)' }}>
                {ownMailbox.words}{' '}
                <Link to={OWN_MAILBOX_GUIDE_HREF} style={{ color: 'var(--text-blue-700)' }}>
                  {ownMailbox.link}
                </Link>
              </p>
              <iframe
                title="The email as they will read it"
                data-send-email
                sandbox=""
                srcDoc={email.html}
                style={{ width: '100%', height: 360, border: '1px solid var(--border)', borderRadius: 8 }}
              />
              {files.length > 0 && (
                <div data-send-files style={{ display: 'grid', gap: '0.3rem' }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {ways.map((w) => (
                      <span key={w.file.key} data-send-file={w.file.key} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '3px 8px', fontSize: '0.75rem', background: 'var(--surface)' }}>
                        {w.file.name}
                        {chipFacts(w, audience, makers).length > 0 && <span style={{ color: 'var(--text-muted)' }}> · {chipFacts(w, audience, makers).join(' · ')}</span>}
                      </span>
                    ))}
                  </div>
                  {fileNote && <p data-send-file-note style={note}>{fileNote}</p>}
                </div>
              )}
              <p style={note}>{sentCopyNote(files.length)} {emailRepliesNote(company)}</p>
            </>
          ) : (
            <>
              <p style={note}>What {contact.name} sees on their phone, under the texts already there.</p>
              <div style={{ fontSize: '0.82rem' }}>
                <strong>To:</strong> {contact.name} {to.number ? `<${to.number}>` : <em style={{ color: 'var(--text-muted)' }}>no mobile number on file</em>}
              </div>
              <div data-send-phone style={{ width: 'min(320px, 100%)', margin: '0 auto', border: '1px solid var(--border-strong)', borderRadius: 18, overflow: 'hidden', background: 'var(--bg-subtle)' }}>
                <div style={{ padding: '0.45rem 0.7rem', borderBottom: '1px solid var(--border)', background: 'var(--surface)', fontSize: '0.8rem', display: 'grid' }}>
                  <strong>{company.name}</strong>
                  <span style={{ color: 'var(--text-muted)' }}>{company.phone || 'the company number'}</span>
                </div>
                <div style={{ padding: '0.6rem', display: 'grid', gap: '0.35rem' }}>
                  {prior.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        justifySelf: m.direction === 'in' ? 'start' : 'end',
                        maxWidth: '85%',
                        whiteSpace: 'pre-wrap',
                        borderRadius: 12,
                        padding: '0.35rem 0.55rem',
                        fontSize: '0.8rem',
                        background: m.direction === 'in' ? 'var(--surface)' : 'var(--bg-blue-tint)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {m.body}
                    </div>
                  ))}
                  <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Now</div>
                  <div data-send-bubble style={{ justifySelf: 'end', maxWidth: '85%', whiteSpace: 'pre-wrap', borderRadius: 12, padding: '0.35rem 0.55rem', fontSize: '0.8rem', background: 'var(--bg-blue-tint)', border: '1px solid var(--border-blue)' }}>
                    {body}
                  </div>
                  {bubble && (
                    <div data-send-optout title={`${bubble.tip.name}. ${bubble.tip.does} ${bubble.tip.changes}`} style={{ justifySelf: 'end', maxWidth: '85%', borderRadius: 12, padding: '0.35rem 0.55rem', fontSize: '0.78rem', background: 'var(--bg-muted)', border: '1px dashed var(--border-strong)', display: 'grid', gap: '0.15rem' }}>
                      <span>{bubble.line}</span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{bubble.tag.join(' · ')}</span>
                    </div>
                  )}
                </div>
              </div>
              {hold && (
                <div data-send-hold style={{ ...note, display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span>{hold.words}</span>
                  <button
                    type="button"
                    title={held ? undefined : `${OPTOUT_HOLD_TIP.name}. ${OPTOUT_HOLD_TIP.does} ${OPTOUT_HOLD_TIP.changes}`}
                    onClick={() => setHeld((v) => !v)}
                    style={{ border: 'none', background: 'transparent', color: 'var(--text-blue-700)', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    {hold.press}
                  </button>
                </div>
              )}
              {fileNote && <p data-send-file-note style={note}>{fileNote}</p>}
              <p style={note}>
                {text.characters} characters · {text.segments} text{text.segments === 1 ? '' : 's'}. {TEXT_FROM_NOTE}
              </p>
            </>
          )}

          {warnings.map((w) => (
            <div key={w} role="status" style={warn}>
              {w}
            </div>
          ))}
          {waits && (
            <div data-send-waits role="status" style={warn}>
              <TextsWaitLine />
            </div>
          )}
          {problem && (
            <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>
              {problem}
            </div>
          )}
        </div>

        {loaded && (
          <div data-after-send={shownMove} style={{ padding: '0.55rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }}>
            <strong>After this sends:</strong>
            <span role="radiogroup" aria-label="After this sends" style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              {(['theirs', 'ours'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={shownMove === m}
                  title={`${moveTips[m].title}. ${moveTips[m].does} ${moveTips[m].changes}`}
                  onClick={() => setMove(m)}
                  style={{ border: 'none', padding: '0.2rem 0.6rem', cursor: 'pointer', background: shownMove === m ? (m === 'ours' ? 'var(--bg-amber-tint)' : 'var(--bg-green-tint)') : 'var(--surface)', fontWeight: shownMove === m ? 600 : 400 }}
                >
                  {m === 'theirs' ? 'Their move' : 'Our move'}
                </button>
              ))}
            </span>
            {moveWords !== null ? (
              <span data-after-words>{moveWords}</span>
            ) : (
              <span style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                We still owe
                <input aria-label="What we still owe" placeholder="what?" value={oweWhat} onChange={(e) => setOweWhat(e.target.value)} style={{ ...input, width: 160, padding: '0.15rem 0.4rem' }} />
                by
                <input aria-label="By when" placeholder="when?" value={oweWhen} onChange={(e) => setOweWhen(e.target.value)} style={{ ...input, width: 120, padding: '0.15rem 0.4rem' }} />
                {whenRead && <em style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{whenRead.known ? `Reads as ${whenRead.label}.` : 'Kept as typed, with no day.'}</em>}
              </span>
            )}
          </div>
        )}

        <div style={{ padding: '0.65rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn onClick={onClose} disabled={busy}>
            Change it
          </Btn>
          <span style={{ flex: 1 }} />
          <Btn kind="primary" onClick={() => void send()} disabled={!goes || busy}>
            {busy ? 'Sending…' : kind === 'email' ? 'Send as email' : 'Send as text'}
          </Btn>
        </div>
        {kind === 'email' && <p style={{ ...note, padding: '0 1rem 0.7rem', color: 'var(--text-muted)' }}>{EMAIL_SOURCES_NOTE}</p>}
      </div>
    </div>
  )
}
