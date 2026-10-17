/**
 * Tell the customer (v2.5593, punch list #115): the sheet that opens before a text goes to a customer, and the receipt
 * after. Two views in one window. **Tell**: the job and the visit, the text ticked with the number it goes to, the
 * office's line filled from the block in a box the office may change, *What happens*, Skip and a primary that says
 * what it will do. **Receipt**: the words as they went, when, and *Call Dana to talk it through?* with the script, a
 * one-tap dial and Done. The rules are `lib/tellCustomer/tellCustomer.ts`; the reads and the send are
 * `lib/tellCustomer/tellCustomerIo.ts`. Drawn for the office team (`GC_OFFICE_TEAM`); anyone else reads the hold.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { useToastContext } from '../../contexts/ToastContext'
import type { UserRole } from '../../hooks/useAuth'
import { GC_OFFICE_TEAM } from '../../lib/gc/access'
import { telHrefFor } from '../../lib/phoneContact'
import { formatErrorMessage } from '../../utils/errorHandling'
import type { QuickReply } from '../../lib/quickReplies/kernel'
import {
  blanksLeftIn,
  firstWord,
  lineFor,
  receiptScript,
  sentLine,
  tellActs,
  tellFills,
  tellHold,
  tellWords,
  TELL_WORDS,
  type TellBlock,
  type TellMoment,
} from '../../lib/tellCustomer/tellCustomer'
import { supabaseTellCustomerIo, type TellContact, type TellCustomerIo, type TellJob } from '../../lib/tellCustomer/tellCustomerIo'

export interface TellCustomerSheetProps {
  moment: TellMoment
  jobId: string
  /** The job as the caller names it: "PLUM 512 · Whitfield water heater". */
  jobLabel: string
  block: TellBlock
  userId: string
  role: UserRole | null | undefined
  onClose: () => void
  /** After a send: the caller reads the thread again if it shows one. */
  onSent?: (messageId: string) => void
  /** For a smoke. */
  io?: TellCustomerIo
  now?: () => number
}

const label: CSSProperties = { fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0.9rem 0 0.3rem' }
const who: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.5rem 0.65rem', display: 'grid', gap: '0.1rem' }
const chan: CSSProperties = { display: 'grid', gridTemplateColumns: '1.4rem 1fr', gap: '0.5rem', alignItems: 'start', padding: '0.5rem 0' }
const tick: CSSProperties = { width: 18, height: 18, borderRadius: 4, border: '1.5px solid var(--border-strong)', marginTop: 2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800 }
const tickOn: CSSProperties = { ...tick, background: '#16a34a', borderColor: '#16a34a', color: '#fff' }
const bubble: CSSProperties = { background: 'var(--bg-orange-tint)', border: '1px solid var(--border-orange)', color: 'var(--text-strong)', borderRadius: 10, padding: '0.7rem 0.85rem', whiteSpace: 'pre-wrap', fontSize: '0.9375rem', lineHeight: 1.4, margin: 0 }
const box: CSSProperties = { ...bubble, width: '100%', minHeight: 96, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical', borderStyle: 'dashed' }
const muted: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0.3rem 0 0' }
const actRow: CSSProperties = { display: 'grid', gridTemplateColumns: '1.4rem 1fr', gap: '0.5rem', alignItems: 'start', fontSize: '0.9375rem', color: 'var(--text-strong)', margin: '0 0 0.4rem' }
const script: CSSProperties = { background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.6rem 0.8rem', fontSize: '0.9375rem', lineHeight: 1.45, margin: 0 }
const footerRow: CSSProperties = { display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center', width: '100%' }
const primaryBtn: CSSProperties = { minHeight: 46, padding: '0 1rem', borderRadius: 10, border: 'none', background: '#16a34a', color: 'white', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer' }
const callBtn: CSSProperties = { ...primaryBtn, background: '#1d4ed8', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }
const secondaryBtn: CSSProperties = { minHeight: 46, padding: '0 0.9rem', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontWeight: 600, cursor: 'pointer' }
const disabled: CSSProperties = { opacity: 0.5, cursor: 'not-allowed' }

type View = { kind: 'tell' } | { kind: 'receipt'; body: string; atMs: number }

export function TellCustomerSheet({ moment, jobId, jobLabel, block, userId, role, onClose, onSent, io: ioProp, now = Date.now }: TellCustomerSheetProps) {
  const { showToast } = useToastContext()
  const io = useMemo(() => ioProp ?? supabaseTellCustomerIo(), [ioProp])
  const office = Boolean(role) && GC_OFFICE_TEAM.includes(role!)
  const [job, setJob] = useState<TellJob | null>(null)
  const [contact, setContact] = useState<TellContact | null | undefined>(undefined)
  const [lines, setLines] = useState<QuickReply[] | null>(null)
  const [textsOn, setTextsOn] = useState<boolean | null>(null)
  const [me, setMe] = useState<string | null>(null)
  const [body, setBody] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<View>({ kind: 'tell' })

  useEffect(() => {
    let live = true
    void (async () => {
      try {
        const [j, l, on, name] = await Promise.all([io.loadJob(jobId), io.loadLines(), io.loadTextsOn(), io.loadMyName(userId)])
        if (!live) return
        setJob(j)
        setLines(l)
        setTextsOn(on)
        setMe(name)
        if (j.customerId && office) {
          try {
            const c = await io.loadContact(j.customerId)
            if (live) setContact(c)
          } catch (e) {
            if (live) {
              setContact(null)
              setProblem(formatErrorMessage(e, 'Their messages could not be opened.'))
            }
          }
        } else setContact(null)
      } catch (e) {
        if (live) setProblem(formatErrorMessage(e, 'The job could not be read.'))
      }
    })()
    return () => {
      live = false
    }
  }, [io, jobId, userId, office])

  const first = firstWord(job?.customerName ?? null)
  const lang = job?.lang ?? 'en'
  const fills = useMemo(() => tellFills({ customerName: job?.customerName ?? null, me, jobName: job?.jobName ?? null, jobAddress: job?.jobAddress ?? null, block }), [job, me, block])
  const line = useMemo(() => (lines ? lineFor(moment, lines, userId) : null), [lines, moment, userId])
  const starting = useMemo(() => (line ? tellWords(line, fills, lang) : null), [line, fills, lang])
  const number = contact?.numbers[0] ?? null
  const loading = job === null || lines === null || textsOn === null || contact === undefined
  const hold = loading ? null : tellHold({ office, hasCustomer: Boolean(job?.customerId), number: number?.value ?? null, stopped: number?.stopped ?? false, textsOn: textsOn === true })
  const text = body ?? starting?.text ?? ''
  const left = blanksLeftIn(text)
  const a = tellActs(moment, first, hold)
  const canSend = !loading && !hold && !busy && text.trim().length > 0 && left.length === 0

  const send = async () => {
    if (!canSend || !contact || !number || !job?.customerId) return
    setBusy(true)
    try {
      const id = await io.send({ contactId: contact.contactId, channelId: number.channelId, jobId, body: text.trim() })
      const atMs = now()
      showToast(TELL_WORDS.sentToast(first), 'success')
      onSent?.(id)
      setView({ kind: 'receipt', body: text.trim(), atMs })
    } catch (e) {
      showToast(formatErrorMessage(e, 'The text did not go.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  if (view.kind === 'receipt') {
    const tel = number ? telHrefFor(number.value) : null
    const footer = (
      <div style={footerRow}>
        <button type="button" style={secondaryBtn} onClick={onClose} data-testid="tell-done">
          {TELL_WORDS.done}
        </button>
        {tel && number ? (
          <a href={tel} style={callBtn} data-testid="tell-call">
            📞 {TELL_WORDS.call(number.value)}
          </a>
        ) : null}
      </div>
    )
    return (
      <ResponsiveModalShell title={TELL_WORDS.receiptTitle(first)} onRequestClose={onClose} footer={footer}>
        <div data-testid="tell-receipt">
          <p style={bubble} data-testid="tell-receipt-words">
            {view.body}
          </p>
          <p style={muted} data-testid="tell-receipt-sent">
            {sentLine(first, view.atMs)}
          </p>
          <p style={label}>{TELL_WORDS.callAsk(first)}</p>
          <p style={{ ...label, margin: '0 0 0.25rem', fontSize: '0.65rem' }}>{TELL_WORDS.whatToSay}</p>
          <p style={script} data-testid="tell-script">
            {receiptScript(moment, fills, 'en')}
          </p>
          <p style={muted}>{TELL_WORDS.callLands(first)}</p>
        </div>
      </ResponsiveModalShell>
    )
  }

  const footer = (
    <div style={footerRow}>
      <button type="button" style={secondaryBtn} disabled={busy} onClick={onClose} data-testid="tell-skip">
        {a.skip}
      </button>
      {hold ? (
        <button type="button" style={secondaryBtn} onClick={onClose} data-testid="tell-primary">
          {a.primary}
        </button>
      ) : (
        <button type="button" style={canSend ? primaryBtn : { ...primaryBtn, ...disabled }} disabled={!canSend} title={left.length ? TELL_WORDS.blanksLeft(left) : undefined} onClick={() => void send()} data-testid="tell-primary">
          {busy ? TELL_WORDS.sending : a.primary}
        </button>
      )}
    </div>
  )

  return (
    <ResponsiveModalShell title={TELL_WORDS.title(first)} onRequestClose={() => !busy && onClose()} footer={footer}>
      <div data-testid="tell-sheet">
        <div style={who}>
          <span style={{ fontWeight: 700 }}>{jobLabel}</span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{`${fills.day ?? block.workDate} · ${fills.window ?? ''}${block.techName ? ` · ${block.techName}` : ''}`}</span>
        </div>
        {problem ? (
          <p role="alert" style={{ ...muted, color: 'var(--text-red-700)' }}>
            {problem}
          </p>
        ) : null}
        {loading && !problem ? (
          <p style={muted}>{TELL_WORDS.reading}</p>
        ) : (
          <>
            <p style={label}>{TELL_WORDS.whatGoes}</p>
            {!hold && number ? (
              <div style={chan}>
                <span style={tickOn} aria-hidden>
                  ✓
                </span>
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {TELL_WORDS.textTo(number.value)} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· {first ?? 'They'} {TELL_WORDS.reads(lang)}</span>
                  </div>
                  <textarea style={box} value={text} aria-label="The text" disabled={busy} onChange={(e) => setBody(e.target.value)} data-testid="tell-body" />
                  <p style={muted}>{left.length ? TELL_WORDS.blanksLeft(left) : TELL_WORDS.editHint(line?.office ?? false, moment)}</p>
                </div>
              </div>
            ) : null}
            <div style={chan}>
              <span style={tick} aria-hidden />
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Email</div>
                <p style={muted}>{TELL_WORDS.noEmail}</p>
              </div>
            </div>
            <p style={label}>{TELL_WORDS.whatHappens}</p>
            {a.rows.map((r) => (
              <p key={r.words} style={r.hold ? { ...actRow, color: 'var(--text-amber-800)' } : actRow} data-testid={r.hold ? 'tell-hold' : 'tell-act'}>
                <span aria-hidden>{r.icon}</span>
                <span>{r.words}</span>
              </p>
            ))}
          </>
        )}
      </div>
    </ResponsiveModalShell>
  )
}
