import { useMemo, useState } from 'react'
import { useToastContext } from '../../../../contexts/ToastContext'
import { useOptionalAuth } from '../../../../hooks/useAuth'
import { SEED_FLOWS } from '../../../../lib/flows/seed'
import { NOTE_BACK_PRESS, NOTE_BACK_TIP, noteBackToast } from '../../../../lib/followUp/queue'
import { OWED_DONE_NEEDS_A_NOTE, OWED_DONE_PLACEHOLDER, OWED_DONE_SEND, OWED_DONE_TOAST, type DayKept } from '../../../../lib/messages/owed'
import { todayYmdInAppTz } from '../../../../utils/dateUtils'
import { NoteBackDay } from '../../../followUp/NoteBackDay'
import { SettlingNote } from '../../../followUp/SettlingNote'
import { useOwedSettling } from '../../../followUp/useOwedSettling'
import { findWhere, qrKindOf, stepsByKind, type QuickReply } from '../../../../lib/quickReplies/kernel'
import { supabaseQuickRepliesIo, type QuickRepliesIo } from '../../../../lib/quickReplies/quickRepliesIo'
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
import { firstName, type Contact } from '../../../../lib/contacts/kernel'
import { formatErrorMessage } from '../../../../utils/errorHandling'
import { Btn } from '../../gcUi'
import { JobPickerWindow } from '../JobPickerWindow'
import { useOpenThread } from '../openThread'
import { useMessagesReread } from '../useMessagesReread'
import { FindReplyWindow } from './FindReplyWindow'
import { QuickRepliesEditor } from './QuickRepliesEditor'
import { CUSTOMER_BAR, CUSTOMER_LOOK, KIND_LOOK, RING } from './kindLook'
import { QuickRepliesStrip } from './QuickRepliesStrip'
import { SendWindow } from './SendWindow'
import { useQuickReplies } from './useQuickReplies'

/** The flows' steps for each kind of person, to name a line's step. The seed until the flows table is read here. */
const STEPS = stepsByKind(SEED_FLOWS)

/** The strip's fold is kept on this computer, as the prototype kept it. */
const QR_OPEN_KEY = 'msgQrOpen'
const readOpen = (): boolean => {
  try {
    return localStorage.getItem(QR_OPEN_KEY) === '1'
  } catch {
    return false
  }
}
const keepOpen = (open: boolean) => {
  try {
    localStorage.setItem(QR_OPEN_KEY, open ? '1' : '0')
  } catch {
    // A browser that keeps nothing still folds and opens; it just forgets.
  }
}

/**
 * Messages, cut 3's screens: the reply box at the foot of a person's thread (`ThreadSlots.box`). The kinds row (Text,
 * Email, Note, the chosen one ringed), the box in the kind's colour with the from line floating in it while it is empty,
 * the count line under it, then *Tie to* at the left and the send at the right. A note goes from here; a text or an
 * email opens the send window first, where nothing goes until its Send. Every word is `compose.ts`'s.
 *
 * It reads the open thread (`useOpenThread`) for the job in view, the rail and our texts; with no window around it (a
 * smoke) it still draws, with no choices for *Tie to*.
 *
 * In a job's window (residential R2) it is given `job`: the reply is tied to that job, *Tie to* names it with no
 * picker, and a text or an email to a customer takes the customer's orange (`CUSTOMER_LOOK`). `kinds` keeps the kinds
 * it offers; with one, the caller's own row chose it and the box draws none.
 */
export function ReplyBox({
  contact,
  io: ioGiven,
  quickIo,
  job,
  kinds,
}: {
  contact: Contact
  io?: ReplyIo
  quickIo?: QuickRepliesIo
  /** The job's window: the job every reply here is tied to, and its name. */
  job?: { key: string; name: string }
  /** The kinds it offers, in `REPLY_KINDS`' order. All three when left out. */
  kinds?: readonly ReplyKind[]
}) {
  const open = useOpenThread()
  const reread = useMessagesReread()
  const { showToast } = useToastContext()
  const me = useOptionalAuth()?.user?.id ?? ''
  const io = useMemo(() => ioGiven ?? supabaseReplyIo(), [ioGiven])
  const qio = useMemo(() => quickIo ?? supabaseQuickRepliesIo(), [quickIo])
  const to = useMemo(() => replyRecipient(contact), [contact])
  const offered = useMemo(() => REPLY_KINDS.filter((k) => !kinds || kinds.includes(k.kind)), [kinds])
  const [chosen, setKind] = useState<ReplyKind>(() => defaultReplyKind(to))
  // The kind it was on, while it is offered; else the first it offers (the caller's row moved it).
  const kind: ReplyKind = offered.some((k) => k.kind === chosen) ? chosen : (offered[0]?.kind ?? chosen)
  const [stripOpen, setStripOpen] = useState(readOpen)
  const [finding, setFinding] = useState(false)
  // The quick replies editor is open; its add row starts with these words when there are any (the prototype's editQuick).
  const [adding, setAdding] = useState<string | null>(null)
  const quick = useQuickReplies(qio, me, goesOut(kind) && (stripOpen || finding))
  const [body, setBody] = useState('')
  const [tie, setTie] = useState<ReplyTie>(undefined)
  const [picking, setPicking] = useState(false)
  const [sending, setSending] = useState<'text' | 'email' | null>(null)
  const [busy, setBusy] = useState(false)
  // Cut 2: marking what we owe done with a team note (the owed strip's press), and a note's day to come back.
  const settling = useOwedSettling(contact.id)
  const [back, setBack] = useState<DayKept | null>(null)
  const [backOpen, setBackOpen] = useState(false)
  const [settleProblem, setSettleProblem] = useState<string | null>(null)
  // While a settle is under way the box is a team note; the kind chosen comes back after it, untouched.
  const shown: ReplyKind = settling.active ? 'note' : kind

  const jobFilter = open?.jobFilter ?? null
  const jobKey = job ? job.key : replyJob(tie, jobFilter, contact.defaultJobId)
  const tiles = open?.tiles ?? {}
  const tieLabel = tieWords(tie, jobFilter, contact.defaultJobId, tiles)
  const company: ComposeCompany = useMemo(() => replyCompany(jobKey), [jobKey])
  const blocked = textBoxBlocked(shown, to)
  const count = goesOut(shown) ? countLine(shown, body) : null
  const sendLabel = settling.active ? OWED_DONE_SEND : (REPLY_KINDS.find((k) => k.kind === shown)?.send ?? 'Send')
  const orange = Boolean(job) && contact.kind === 'customer' && goesOut(shown)

  /** After a send or a note: the box empties and the page reads again, with one toast for all it did. */
  const after = (sentKind: ReplyKind, more?: string | null) => {
    setBody('')
    setTie(undefined)
    showToast([sentWords(sentKind, company), more].filter(Boolean).join(' '), 'success')
    reread()
  }

  const settle = async (text: string) => {
    if (!text) {
      setSettleProblem(OWED_DONE_NEEDS_A_NOTE)
      return
    }
    setSettleProblem(null)
    setBusy(true)
    try {
      await settling.done(text, jobKey)
      setBody('')
      setTie(undefined)
      showToast(OWED_DONE_TOAST, 'success')
      reread()
    } catch (e) {
      setSettleProblem(formatErrorMessage(e, 'It was not marked done.'))
    } finally {
      setBusy(false)
    }
  }

  const press = async () => {
    const text = body.trim()
    if (settling.active) {
      await settle(text)
      return
    }
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
      await io.addNote(contact.id, text, jobKey, back)
      after('note', noteBackToast(back))
      setBack(null)
      setBackOpen(false)
    } catch (e) {
      showToast(formatErrorMessage(e, 'The note was not added.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const theirs = (open?.rail ?? []).map((k) => tiles[k]).filter((t): t is NonNullable<typeof t> => Boolean(t))

  // Quick replies: typing folds an open strip until the box is empty again; a press on the folded line peeks at it.
  const [peek, setPeek] = useState(false)
  const kindSteps = STEPS[qrKindOf(contact.kind)] ?? []
  const first = contact.kind === 'unknown' ? contact.name : firstName(contact)
  // Where they are in the flow waits on cut 4's read of a person's step; until it is here, nothing is on.
  const where = findWhere({ step: null, who: 'us', firstName: first, daysOn: null, off: false })
  const use = (q: QuickReply) => {
    setBody(q.text)
    setFinding(false)
    setPeek(false)
    quick.press(q, contact.id)
  }

  return (
    <div
      data-reply-box
      style={{
        // In a job's window the panel's card holds it, so it takes no foot of its own.
        ...(job ? null : { background: 'var(--surface)', borderTop: '1px solid var(--border)', boxShadow: '0 -6px 14px -10px rgba(15, 23, 42, 0.3)', padding: '0.6rem 0.9rem 0.75rem' }),
        display: 'grid',
        gap: '0.4rem',
        position: 'relative',
      }}
    >
      {offered.length > 1 && (
        <div role="radiogroup" aria-label="Reply as" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {offered.map((k) => (
            <button
              key={k.kind}
              type="button"
              role="radio"
              aria-checked={shown === k.kind}
              aria-disabled={settling.active || undefined}
              onClick={() => !settling.active && setKind(k.kind)}
              style={{ ...KIND_LOOK[k.kind], borderWidth: 1, borderStyle: 'solid', borderRadius: 6, padding: '0.2rem 0.7rem', fontSize: '0.82rem', cursor: settling.active ? 'not-allowed' : 'pointer', ...(shown === k.kind ? RING : null) }}
            >
              {k.label}
            </button>
          ))}
          {shown === 'note' && <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{NOTE_ASIDE.join(' · ')}</span>}
        </div>
      )}

      {goesOut(shown) && (
        <QuickRepliesStrip
          kind={contact.kind}
          lines={quick.lines}
          me={me}
          nowStepId={null}
          steps={kindSteps}
          open={stripOpen && (!body.trim() || peek)}
          problem={quick.problem}
          onOpen={(o) => {
            setStripOpen(o)
            keepOpen(o)
            setPeek(o && Boolean(body.trim()))
          }}
          onUse={use}
          onFind={() => setFinding(true)}
          onEdit={() => setAdding('')}
          onAdd={(words) => setAdding(words)}
        />
      )}

      {settling.active && settling.owed && <SettlingNote owed={settling.owed} onNotYet={settling.cancel} nowIso={open?.nowIso} />}
      {shown === 'note' && !settling.active && (backOpen || back) && (
        <NoteBackDay
          value={back}
          onChange={(day) => {
            setBack(day)
            // "No day ×" clears it, and the chips fold back to the press.
            if (!day) setBackOpen(false)
          }}
          todayYmd={todayYmdInAppTz()}
        />
      )}

      <div style={{ position: 'relative' }}>
        <textarea
          aria-label={shown === 'note' ? 'A note for the team' : `Write to ${contact.name}`}
          value={body}
          onChange={(e) => {
            setBody(e.target.value)
            if (settleProblem) setSettleProblem(null)
          }}
          placeholder={settling.active ? OWED_DONE_PLACEHOLDER : boxPlaceholder(shown, contact.name)}
          disabled={Boolean(blocked) || busy}
          rows={3}
          data-reply-look={orange ? 'customer' : shown}
          style={{
            ...(orange ? CUSTOMER_LOOK : KIND_LOOK[shown]),
            width: '100%',
            minHeight: 64,
            resize: 'vertical',
            display: 'block',
            borderWidth: 1, borderStyle: 'solid',
            ...(orange ? CUSTOMER_BAR : null),
            borderRadius: 8,
            padding: '0.5rem 0.6rem',
            font: 'inherit',
            fontSize: '0.9rem',
            boxSizing: 'border-box',
          }}
        />
        {goesOut(shown) && !body && (
          <span
            data-reply-from
            aria-hidden="true"
            style={{ position: 'absolute', right: '0.6rem', bottom: '0.45rem', fontSize: '0.72rem', color: 'var(--text-muted)', pointerEvents: 'none' }}
          >
            {fromLine(shown, company).join(' · ')}
          </span>
        )}
      </div>

      {settleProblem && (
        <div role="alert" style={{ fontSize: '0.8rem', color: 'var(--text-red-700)' }}>
          {settleProblem}
        </div>
      )}

      {count && count.parts.length > 0 && (
        <div data-reply-count style={{ fontSize: '0.75rem', color: count.long ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>
          {count.parts.join(' · ')}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {job ? (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-600)' }}>
            Tie to: <span data-reply-tie>{job.name}</span>
          </span>
        ) : (
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
        )}
        <span style={{ flex: 1 }} />
        {shown === 'note' && !settling.active && !backOpen && !back && (
          <button
            type="button"
            data-reply-back
            title={NOTE_BACK_TIP}
            onClick={() => setBackOpen(true)}
            style={{ border: 'none', background: 'transparent', color: 'var(--text-blue-700)', cursor: 'pointer', fontSize: '0.8rem' }}
          >
            {NOTE_BACK_PRESS}
          </button>
        )}
        {blocked && <span style={{ fontSize: '0.8rem', color: 'var(--text-red-700)' }}>{blocked}</span>}
        <Btn
          kind="primary"
          onClick={() => void press()}
          disabled={Boolean(blocked) || busy}
          title={
            settling.active
              ? 'Marks what we owed done and keeps your words in the thread. The row closes as any note does.'
              : shown === 'note'
                ? 'Adds the note to the thread and closes the row. Only the team sees it.'
                : 'Shows it the way they will see it, before it goes. Nothing sends until you press Send there.'
          }
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

      {finding && (
        <FindReplyWindow
          contact={contact}
          lines={quick.lines ?? []}
          threadLines={open?.lines ?? []}
          me={me}
          nowStepId={null}
          steps={kindSteps}
          where={where}
          onUse={use}
          onAdd={(words) => {
            setFinding(false)
            setAdding(words)
          }}
          onEdit={() => {
            setFinding(false)
            setAdding('')
          }}
          onClose={() => setFinding(false)}
        />
      )}

      {adding !== null && (
        <QuickRepliesEditor
          io={qio}
          me={me}
          steps={STEPS}
          names={open?.userNames ?? {}}
          contactNames={{ [contact.id]: contact.name }}
          initialAdd={adding}
          onChanged={quick.reload}
          onClose={() => setAdding(null)}
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
          onSent={(sentKind, more) => {
            setSending(null)
            setKind(sentKind)
            after(sentKind, more)
          }}
        />
      )}
    </div>
  )
}
