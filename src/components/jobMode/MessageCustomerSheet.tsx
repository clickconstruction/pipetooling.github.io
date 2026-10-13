/**
 * Messages, residential R5: Job Mode's **Message the customer** sheet (screen 2 of `customer-messages-prototype.html`
 * v0.8 on branch spike/gc-mode). Full screen on a phone (`ResponsiveModalShell`). Three views:
 *
 * - **The lines**: their answer when one waits, then the phone's lines as big buttons, each by its short name with a
 *   hint, and **Something else** last.
 * - **The preview**: the line filled for this customer, in their orange, the fill row for what only the tech knows,
 *   and **Send**, which waits until every blank is filled.
 * - **Something else**: a note on the job for the office, who sends what the customer should hear.
 *
 * The words and rules are `lib/jobModeMessageCustomer.ts`; the reads and writes are its `Io`.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { CUSTOMER_BAR, CUSTOMER_LOOK } from '../gc/messages/reply/kindLook'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { scheduleTodayDateKey } from '../../lib/jobScheduleChicago'
import {
  jobModeFills,
  noteForOffice,
  previewOf,
  SHEET_WORDS,
  sheetRows,
  waitingAnswer,
  type JobModeBlock,
} from '../../lib/jobModeMessageCustomer'
import type { JobModeCustomer, JobModeMessageIo } from '../../lib/jobModeMessageCustomerIo'
import type { PhoneLine } from '../../lib/quickReplies/phone'

export interface MessageCustomerSheetProps {
  jobId: string
  jobName: string | null
  jobAddress: string | null
  userId: string
  /** The signed-in tech's name. */
  me: string | null
  /** The job's customer, as the door read them. */
  customer: JobModeCustomer
  io: JobModeMessageIo
  /** After a text or a note goes: the door reads their thread again. */
  onDone: () => void
  onClose: () => void
  /** Today in Chicago, YYYY-MM-DD. A smoke passes its own. */
  today?: string
}

type View = { kind: 'lines' } | { kind: 'preview'; line: PhoneLine } | { kind: 'else' }

const muted: CSSProperties = { fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0 0 0.75rem' }
const lineBtn: CSSProperties = {
  display: 'block',
  width: '100%',
  minHeight: 56,
  textAlign: 'left',
  padding: '0.7rem 0.9rem',
  marginBottom: '0.5rem',
  borderRadius: 10,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-900)',
  cursor: 'pointer',
}
const lineName: CSSProperties = { display: 'block', fontWeight: 700, fontSize: '1rem' }
const lineHint: CSSProperties = { display: 'block', fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }
const bubble: CSSProperties = { ...CUSTOMER_LOOK, ...CUSTOMER_BAR, borderWidth: 1, borderStyle: 'solid', borderRadius: 10, padding: '0.75rem 0.9rem', whiteSpace: 'pre-wrap', fontSize: '1rem' }
const theirBubble: CSSProperties = { border: '1px solid var(--border)', background: 'var(--surface-muted)', borderRadius: 10, padding: '0.6rem 0.8rem', margin: '0.25rem 0 1rem', whiteSpace: 'pre-wrap' }
const fieldLabel: CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: 600, margin: '0.75rem 0 0.25rem' }
const field: CSSProperties = { width: '100%', minHeight: 48, fontSize: '1rem', padding: '0.5rem 0.65rem', borderRadius: 8, border: '1px solid var(--border-strong)', boxSizing: 'border-box' }
const footerRow: CSSProperties = { display: 'flex', gap: '0.5rem', justifyContent: 'space-between', width: '100%' }
const primaryBtn: CSSProperties = { minHeight: 48, padding: '0 1.1rem', borderRadius: 10, border: 'none', background: '#c2410c', color: 'white', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }
const secondaryBtn: CSSProperties = { minHeight: 48, padding: '0 1rem', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-900)', fontWeight: 600, cursor: 'pointer' }

const firstOf = (name: string | null) => name?.trim().split(/\s+/)[0] || null

export function MessageCustomerSheet({ jobId, jobName, jobAddress, userId, me, customer, io, onDone, onClose, today = scheduleTodayDateKey() }: MessageCustomerSheetProps) {
  const { showToast } = useToastContext()
  const [lines, setLines] = useState<PhoneLine[] | null>(null)
  const [blocks, setBlocks] = useState<JobModeBlock[]>([])
  const [problem, setProblem] = useState<string | null>(null)
  const [view, setView] = useState<View>({ kind: 'lines' })
  const [typed, setTyped] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    Promise.all([io.loadLines(), io.loadBlocks(jobId, userId, today)]).then(
      ([l, b]) => {
        if (!live) return
        setLines(l)
        setBlocks(b)
      },
      (e: unknown) => live && setProblem(formatErrorMessage(e, 'The phone’s lines could not be read.')),
    )
    return () => {
      live = false
    }
  }, [io, jobId, userId, today])

  const first = firstOf(customer.customerName)
  const fills = useMemo(
    () => jobModeFills({ customerName: customer.customerName, me, jobName, jobAddress, blocks, today }),
    [customer.customerName, me, jobName, jobAddress, blocks, today],
  )
  const rows = useMemo(() => (lines ? sheetRows(lines, null, fills) : []), [lines, fills])
  const answer = waitingAnswer(customer.tail)
  const preview = view.kind === 'preview' ? previewOf(view.line, fills, typed) : null

  const pick = (line: PhoneLine) => {
    setTyped({})
    setView({ kind: 'preview', line })
  }

  const sendLine = async () => {
    if (view.kind !== 'preview' || !preview || preview.stop || !customer.customerId || busy) return
    setBusy(true)
    try {
      await io.send({ from: 'job_mode', customerId: customer.customerId, contactId: customer.contactId, jobId, quickReplyId: view.line.id, body: preview.text })
      showToast(SHEET_WORDS.sent(first), 'success')
      onDone()
      onClose()
    } catch (e) {
      showToast(formatErrorMessage(e, 'The text did not go.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const sendNote = async () => {
    const body = noteForOffice(note, customer.customerName)
    if (!body || busy) return
    setBusy(true)
    try {
      await io.noteToOffice(jobId, userId, body)
      showToast(SHEET_WORDS.noteSent, 'success')
      onDone()
      onClose()
    } catch (e) {
      showToast(formatErrorMessage(e, 'The note did not save.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const back = (
    <button type="button" style={secondaryBtn} onClick={() => setView({ kind: 'lines' })} disabled={busy}>
      {SHEET_WORDS.back}
    </button>
  )
  const footer =
    view.kind === 'preview' ? (
      <div style={footerRow}>
        {back}
        <button
          type="button"
          style={preview?.stop || busy ? { ...primaryBtn, opacity: 0.5, cursor: 'not-allowed' } : primaryBtn}
          disabled={Boolean(preview?.stop) || busy}
          title={preview?.stop ?? undefined}
          onClick={() => void sendLine()}
          data-testid="job-mode-message-send"
        >
          {busy ? 'Sending…' : SHEET_WORDS.send(first)}
        </button>
      </div>
    ) : view.kind === 'else' ? (
      <div style={footerRow}>
        {back}
        <button
          type="button"
          style={!note.trim() || busy ? { ...primaryBtn, opacity: 0.5, cursor: 'not-allowed' } : primaryBtn}
          disabled={!note.trim() || busy}
          onClick={() => void sendNote()}
          data-testid="job-mode-message-note-send"
        >
          {busy ? 'Saving…' : SHEET_WORDS.somethingElse.send}
        </button>
      </div>
    ) : undefined

  return (
    <ResponsiveModalShell title={SHEET_WORDS.title(first)} onRequestClose={() => !busy && onClose()} footer={footer}>
      <div data-testid="job-mode-message-sheet">
        {view.kind === 'lines' ? (
          <>
            {answer ? (
              <section aria-label="Their answer" data-testid="job-mode-message-answer">
                <p style={{ ...muted, margin: 0, fontWeight: 600, color: 'var(--text-900)' }}>{SHEET_WORDS.answered(first)}</p>
                <p style={theirBubble}>{answer.body}</p>
              </section>
            ) : null}
            {!customer.customerId ? (
              <p role="status" style={muted} data-testid="job-mode-message-no-customer">
                {SHEET_WORDS.noCustomer}
              </p>
            ) : problem ? (
              <p role="alert" style={{ ...muted, color: 'var(--text-red-700)' }}>
                {problem}
              </p>
            ) : !lines ? (
              <p style={muted}>Reading the phone’s lines…</p>
            ) : rows.length === 0 ? (
              <p role="status" style={muted}>
                {SHEET_WORDS.none}
              </p>
            ) : (
              <>
                <p style={muted}>{SHEET_WORDS.pick}</p>
                {rows.map((r) => (
                  <button key={r.line.id} type="button" style={lineBtn} onClick={() => pick(r.line)} data-testid="job-mode-message-line">
                    <span style={lineName}>{r.name}</span>
                    <span style={lineHint}>{r.hint}</span>
                  </button>
                ))}
              </>
            )}
            <button type="button" style={{ ...lineBtn, borderStyle: 'dashed' }} onClick={() => setView({ kind: 'else' })} data-testid="job-mode-message-else">
              <span style={lineName}>{SHEET_WORDS.somethingElse.label}</span>
              <span style={lineHint}>{SHEET_WORDS.somethingElse.hint}</span>
            </button>
            {customer.customerId ? <p style={{ ...muted, marginTop: '0.5rem' }}>{SHEET_WORDS.answerComes}</p> : null}
          </>
        ) : view.kind === 'preview' && preview ? (
          <>
            <p style={muted}>{SHEET_WORDS.preview(first)}</p>
            <p style={bubble} data-testid="job-mode-message-preview">
              {preview.text}
            </p>
            {preview.asks.map((a) => (
              <label key={a.key} style={fieldLabel}>
                {a.words}
                <input
                  style={field}
                  value={typed[a.key] ?? ''}
                  onChange={(e) => setTyped((t) => ({ ...t, [a.key]: e.target.value }))}
                  inputMode={a.key === 'minutes' ? 'numeric' : undefined}
                  data-testid={`job-mode-message-fill-${a.key.replace(/\s+/g, '-')}`}
                />
              </label>
            ))}
            {preview.stop ? (
              <p role="status" style={{ ...muted, marginTop: '0.75rem' }}>
                {preview.stop}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <p style={muted}>{SHEET_WORDS.somethingElse.note}</p>
            <label style={fieldLabel}>
              Your note
              <textarea
                style={{ ...field, minHeight: 120, resize: 'vertical' }}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                data-testid="job-mode-message-note"
              />
            </label>
          </>
        )}
      </div>
    </ResponsiveModalShell>
  )
}
