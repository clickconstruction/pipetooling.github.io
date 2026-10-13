import { useMemo, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../../../contexts/ToastContext'
import {
  boxPlaceholder,
  countLine,
  defaultReplyKind,
  fromLine,
  goesOut,
  NOTE_ASIDE,
  REPLY_KINDS,
  replyRecipient,
  sentWords,
  textBoxBlocked,
  type ComposeCompany,
  type ReplyKind,
} from '../../../../lib/messages/compose'
import { replyCompany, replyJob, tieWords, TIE_TIP, type ReplyTie } from '../../../../lib/messages/replyBox'
import { supabaseReplyIo, type ReplyIo } from '../../../../lib/messages/replyIo'
import type { Contact } from '../../../../lib/contacts/kernel'
import { formatErrorMessage } from '../../../../utils/errorHandling'
import { Btn } from '../../gcUi'
import { JobPickerWindow } from '../JobPickerWindow'
import { useOpenThread } from '../openThread'
import { useMessagesReread } from '../useMessagesReread'
import { SendWindow } from './SendWindow'

/** Text blue, Email white, Note yellow: the thread's own colours for each, so the box reads as the line it becomes. */
const KIND_LOOK: Record<ReplyKind, CSSProperties> = {
  text: { background: 'var(--bg-blue-tint)', borderColor: 'var(--border-blue)', color: 'var(--text-blue-800)' },
  email: { background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-base)' },
  note: { background: 'var(--bg-yellow-tint)', borderColor: 'var(--border-amber-soft)', color: 'var(--text-base)' },
}

/** The chosen kind wears the orange ring. */
const RING: CSSProperties = { boxShadow: '0 0 0 3px var(--border-orange)', borderColor: 'var(--border-orange)', fontWeight: 600 }

/**
 * Messages, cut 3's screens: the reply box at the foot of a person's thread (`ThreadSlots.box`). The kinds row (Text,
 * Email, Note, the chosen one ringed), the box in the kind's colour with the from line floating in it while it is empty,
 * the count line under it, then *Tie to* at the left and the send at the right. A note goes from here; a text or an
 * email opens the send window first, where nothing goes until its Send. Every word is `compose.ts`'s.
 *
 * It reads the open thread (`useOpenThread`) for the job in view, the rail and our texts; with no window around it (a
 * smoke) it still draws, with no choices for *Tie to*.
 */
export function ReplyBox({ contact, io: ioGiven }: { contact: Contact; io?: ReplyIo }) {
  const open = useOpenThread()
  const reread = useMessagesReread()
  const { showToast } = useToastContext()
  const io = useMemo(() => ioGiven ?? supabaseReplyIo(), [ioGiven])
  const to = useMemo(() => replyRecipient(contact), [contact])
  const [kind, setKind] = useState<ReplyKind>(() => defaultReplyKind(to))
  const [body, setBody] = useState('')
  const [tie, setTie] = useState<ReplyTie>(undefined)
  const [picking, setPicking] = useState(false)
  const [sending, setSending] = useState<'text' | 'email' | null>(null)
  const [busy, setBusy] = useState(false)

  const jobFilter = open?.jobFilter ?? null
  const jobKey = replyJob(tie, jobFilter, contact.defaultJobId)
  const tiles = open?.tiles ?? {}
  const tieLabel = tieWords(tie, jobFilter, contact.defaultJobId, tiles)
  const company: ComposeCompany = useMemo(() => replyCompany(jobKey), [jobKey])
  const blocked = textBoxBlocked(kind, to)
  const count = goesOut(kind) ? countLine(kind, body) : null
  const sendLabel = REPLY_KINDS.find((k) => k.kind === kind)?.send ?? 'Send'

  const after = (sentKind: ReplyKind) => {
    setBody('')
    setTie(undefined)
    showToast(sentWords(sentKind, company), 'success')
    reread()
  }

  const press = async () => {
    const text = body.trim()
    if (!text) {
      showToast(kind === 'note' ? 'Write the note first.' : 'Write the message first.', 'info')
      return
    }
    if (kind !== 'note') {
      setSending(kind)
      return
    }
    setBusy(true)
    try {
      await io.addNote(contact.id, text, jobKey)
      after('note')
    } catch (e) {
      showToast(formatErrorMessage(e, 'The note was not added.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const theirs = (open?.rail ?? []).map((k) => tiles[k]).filter((t): t is NonNullable<typeof t> => Boolean(t))

  return (
    <div
      data-reply-box
      style={{
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        boxShadow: '0 -6px 14px -10px rgba(15, 23, 42, 0.3)',
        padding: '0.6rem 0.9rem 0.75rem',
        display: 'grid',
        gap: '0.4rem',
        position: 'relative',
      }}
    >
      <div role="radiogroup" aria-label="Reply as" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {REPLY_KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            role="radio"
            aria-checked={kind === k.kind}
            onClick={() => setKind(k.kind)}
            style={{ ...KIND_LOOK[k.kind], border: '1px solid', borderRadius: 6, padding: '0.2rem 0.7rem', fontSize: '0.82rem', cursor: 'pointer', ...(kind === k.kind ? RING : null) }}
          >
            {k.label}
          </button>
        ))}
        {kind === 'note' && <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{NOTE_ASIDE.join(' · ')}</span>}
      </div>

      <div style={{ position: 'relative' }}>
        <textarea
          aria-label={kind === 'note' ? 'A note for the team' : `Write to ${contact.name}`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={boxPlaceholder(kind, contact.name)}
          disabled={Boolean(blocked) || busy}
          rows={3}
          style={{
            ...KIND_LOOK[kind],
            width: '100%',
            minHeight: 64,
            resize: 'vertical',
            display: 'block',
            border: '1px solid',
            borderRadius: 8,
            padding: '0.5rem 0.6rem',
            font: 'inherit',
            fontSize: '0.9rem',
            boxSizing: 'border-box',
          }}
        />
        {goesOut(kind) && !body && (
          <span
            data-reply-from
            aria-hidden="true"
            style={{ position: 'absolute', right: '0.6rem', bottom: '0.45rem', fontSize: '0.72rem', color: 'var(--text-muted)', pointerEvents: 'none' }}
          >
            {fromLine(kind, company).join(' · ')}
          </span>
        )}
      </div>

      {count && count.parts.length > 0 && (
        <div data-reply-count style={{ fontSize: '0.75rem', color: count.long ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>
          {count.parts.join(' · ')}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-600)' }}>
          Tie to:{' '}
          <button
            type="button"
            data-reply-tie
            title={`${TIE_TIP.title}. ${TIE_TIP.does} ${TIE_TIP.changes}`}
            onClick={() => setPicking(true)}
            style={{ border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', padding: '0.15rem 0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}
          >
            {tieLabel.job}
            {tieLabel.aside && <span style={{ color: 'var(--text-muted)' }}> · {tieLabel.aside}</span>} ▾
          </button>
        </span>
        <span style={{ flex: 1 }} />
        {blocked && <span style={{ fontSize: '0.8rem', color: 'var(--text-red-700)' }}>{blocked}</span>}
        <Btn
          kind="primary"
          onClick={() => void press()}
          disabled={Boolean(blocked) || busy}
          title={kind === 'note' ? 'Adds the note to the thread and closes the row. Only the team sees it.' : 'Shows it the way they will see it, before it goes. Nothing sends until you press Send there.'}
        >
          {sendLabel}
        </Btn>
      </div>

      {picking && (
        <JobPickerWindow
          title="Tie this reply to a job"
          theirs={theirs}
          untie
          searchJobs={open?.searchJobs ?? (async () => [])}
          onPick={(key) => {
            setPicking(false)
            setTie(key)
          }}
          onClose={() => setPicking(false)}
        />
      )}

      {sending && (
        <SendWindow
          contact={contact}
          kind={sending}
          body={body.trim()}
          jobKey={jobKey}
          company={company}
          io={io}
          onKind={setSending}
          onClose={() => setSending(null)}
          onSent={(sentKind) => {
            setSending(null)
            setKind(sentKind)
            after(sentKind)
          }}
        />
      )}
    </div>
  )
}
