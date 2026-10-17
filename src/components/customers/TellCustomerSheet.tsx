/**
 * Tell the customer (v2.5593, punch list #115): the sheet that opens before a text goes to a customer, and the receipt
 * after. Two views in one window. **Tell**: the job and the visit (or the estimate, v2.5594), the channels that apply
 * ticked with where each goes, the office's line filled in a box the office may change, *What happens*, Skip and a
 * primary that says what it will do. **Receipt**: what went and when, and *Call Dana to talk it through?* with the
 * script, a one-tap dial and Done. On an estimate the email goes first through the page's own send, then the text with
 * the link the email came back with. The rules are `lib/tellCustomer/tellCustomer.ts`; the reads and the send are
 * `lib/tellCustomer/tellCustomerIo.ts`. Drawn for the office team (`GC_OFFICE_TEAM`); anyone else reads the hold.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { useToastContext } from '../../contexts/ToastContext'
import type { UserRole } from '../../hooks/useAuth'
import { GC_OFFICE_TEAM } from '../../lib/gc/access'
import { telHrefFor } from '../../lib/phoneContact'
import { formatErrorMessage } from '../../utils/errorHandling'
import { CALL_WORDS, callWhat, dayAfter } from '../../lib/calls/callTasks'
import { weekdayDate } from '../../lib/gc/words'
import { jobKey } from '../../lib/messages/jobKeys'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { morningSendOn, TODAYS_SENDS_WORDS } from '../../lib/offers/offers'
import { fillLine } from '../../lib/quickReplies/blanks'
import type { QuickReply } from '../../lib/quickReplies/kernel'
import {
  blanksLeftIn,
  emailSentLine,
  firstWord,
  lineFor,
  MOMENT_STEP,
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
import { supabaseTellCustomerIo, type TellCallScript, type TellContact, type TellCustomerIo, type TellJob } from '../../lib/tellCustomer/tellCustomerIo'

/** The estimate the sheet sends (v2.5594): its facts, and the page's own email send, which answers the link the text carries. */
export interface TellEstimate {
  customerId: string
  email: string
  /** "$1,850.00" */
  amount: string
  title: string
  /** The pipeline job the estimate sits on, or null before one exists. */
  jobId: string | null
  /** The page's send: emails the estimate and answers the accept link, or null when it failed (the page said so). */
  sendEmail: () => Promise<{ acceptUrl: string | null; emailed: boolean } | null>
}

export interface TellCustomerSheetProps {
  moment: TellMoment
  /** The pipeline job; null on an estimate before a job exists. */
  jobId: string | null
  /** The job or the estimate as the caller names it: "PLUM 512 · Whitfield water heater", "Estimate #512 · Whitfield water heater". */
  jobLabel: string
  block?: TellBlock | null
  estimate?: TellEstimate | null
  userId: string
  role: UserRole | null | undefined
  onClose: () => void
  /** After a text went: the caller reads the thread again if it shows one. */
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
const mail: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.5rem 0.75rem', fontSize: '0.875rem', background: 'var(--bg-subtle)', margin: 0 }
const muted: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0.3rem 0 0' }
const actRow: CSSProperties = { display: 'grid', gridTemplateColumns: '1.4rem 1fr', gap: '0.5rem', alignItems: 'start', fontSize: '0.9375rem', color: 'var(--text-strong)', margin: '0 0 0.4rem' }
const script: CSSProperties = { background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.6rem 0.8rem', fontSize: '0.9375rem', lineHeight: 1.45, margin: 0 }
const footerRow: CSSProperties = { display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center', width: '100%' }
const primaryBtn: CSSProperties = { minHeight: 46, padding: '0 1rem', borderRadius: 10, border: 'none', background: '#16a34a', color: 'white', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer' }
const callBtn: CSSProperties = { ...primaryBtn, background: '#1d4ed8', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }
const secondaryBtn: CSSProperties = { minHeight: 46, padding: '0 0.9rem', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontWeight: 600, cursor: 'pointer' }
const quietBtn: CSSProperties = { border: 'none', background: 'none', color: 'var(--text-link)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', padding: '0.5rem 0.4rem' }
const disabled: CSSProperties = { opacity: 0.5, cursor: 'not-allowed' }

type View = { kind: 'tell' } | { kind: 'receipt'; text: string | null; email: string | null; atMs: number } | { kind: 'morning'; day: string }

export function TellCustomerSheet({ moment, jobId, jobLabel, block, estimate, userId, role, onClose, onSent, io: ioProp, now = Date.now }: TellCustomerSheetProps) {
  const { showToast } = useToastContext()
  const io = useMemo(() => ioProp ?? supabaseTellCustomerIo(), [ioProp])
  const office = Boolean(role) && GC_OFFICE_TEAM.includes(role!)
  const [job, setJob] = useState<TellJob | null>(null)
  const [contact, setContact] = useState<TellContact | null | undefined>(undefined)
  const [lines, setLines] = useState<QuickReply[] | null>(null)
  const [textsOn, setTextsOn] = useState<boolean | null>(null)
  const [me, setMe] = useState<string | null>(null)
  const [callScript, setCallScript] = useState<TellCallScript | null>(null)
  const [body, setBody] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<View>({ kind: 'tell' })

  useEffect(() => {
    let live = true
    void (async () => {
      try {
        const [j, l, on, name, cs] = await Promise.all([
          estimate ? io.loadCustomer(estimate.customerId).then((c) => ({ customerId: estimate.customerId, customerName: c.name, jobName: null, jobAddress: null, lang: c.lang }) as TellJob) : jobId ? io.loadJob(jobId) : Promise.reject(new Error('No job and no estimate.')),
          io.loadLines(),
          io.loadTextsOn(),
          io.loadMyName(userId),
          // The step's call script (v2.5596); a read that fails leaves the app's own words.
          io.loadCallScript(MOMENT_STEP[moment]).catch(() => null),
        ])
        if (!live) return
        setJob(j)
        setLines(l)
        setTextsOn(on)
        setMe(name)
        setCallScript(cs)
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
  }, [io, jobId, userId, office, estimate, moment])

  const first = firstWord(job?.customerName ?? null)
  const lang = job?.lang ?? 'en'
  const fills = useMemo(
    () => tellFills({ customerName: job?.customerName ?? null, me, jobName: job?.jobName ?? null, jobAddress: job?.jobAddress ?? null, block, estimate: estimate ? { amount: estimate.amount, title: estimate.title } : null }),
    [job, me, block, estimate],
  )
  const line = useMemo(() => (lines ? lineFor(moment, lines, userId) : null), [lines, moment, userId])
  const starting = useMemo(() => (line ? tellWords(line, fills, lang) : null), [line, fills, lang])
  const number = contact?.numbers[0] ?? null
  const loading = job === null || lines === null || textsOn === null || contact === undefined
  const hold = loading ? null : tellHold({ office, hasCustomer: Boolean(job?.customerId), number: number?.value ?? null, stopped: number?.stopped ?? false, textsOn: textsOn === true })
  const text = body ?? starting?.text ?? ''
  const left = blanksLeftIn(text, moment)
  const a = tellActs(moment, first, hold)
  const textCanGo = !hold && Boolean(contact) && Boolean(number)
  const canSend = !loading && !busy && (moment === 'estimate' ? Boolean(estimate) && (!textCanGo || (text.trim().length > 0 && left.length === 0)) : textCanGo && text.trim().length > 0 && left.length === 0)

  const sendText = async (bodyToSend: string): Promise<string | null> => {
    if (!contact || !number) return null
    const id = await io.send({ contactId: contact.contactId, channelId: number.channelId, jobId: estimate ? estimate.jobId : jobId, body: bodyToSend })
    onSent?.(id)
    return bodyToSend
  }

  /** The press: on a booking the text; on an estimate the email first, then the text with the link it came back with. */
  const go = async (withText: boolean) => {
    if (!canSend) return
    setBusy(true)
    try {
      if (moment === 'estimate' && estimate) {
        const r = await estimate.sendEmail()
        if (!r) return
        const atMs = now()
        let sentText: string | null = null
        if (withText && textCanGo) {
          if (r.acceptUrl) {
            try {
              sentText = await sendText(fillLine(text.trim(), { link: r.acceptUrl }).text)
              showToast(TELL_WORDS.bothSentToast(first), 'success')
            } catch (e) {
              showToast(formatErrorMessage(e, TELL_WORDS.textFailed), 'error')
            }
          } else showToast(TELL_WORDS.emailOnlyToast, 'error')
        }
        setView({ kind: 'receipt', text: sentText, email: estimate.email, atMs })
        return
      }
      const sentText = await sendText(text.trim())
      showToast(TELL_WORDS.sentToast(first), 'success')
      setView({ kind: 'receipt', text: sentText, email: null, atMs: now() })
    } catch (e) {
      showToast(formatErrorMessage(e, 'The text did not go.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  /** Send in the morning (v2.5595): the text waits on Today's sends, and the morning run sends it at 9 AM on its day. */
  const morning = async () => {
    if (!canSend || !contact || !number || moment === 'estimate') return
    setBusy(true)
    try {
      const day = morningSendOn(now())
      await io.makeOffer({ contactId: contact.contactId, channelId: number.channelId, jobId, stepKey: MOMENT_STEP[moment], body: text.trim(), sendOn: day })
      showToast(TODAYS_SENDS_WORDS.morningToast(weekdayDate(day)), 'success')
      setView({ kind: 'morning', day })
    } catch (e) {
      showToast(formatErrorMessage(e, 'The text was not prepared.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  /** Add to my calls (v2.5596): a call task for tomorrow in Follow up's We owe them, with the script as filled. */
  const addCall = async () => {
    if (!contact) return
    setBusy(true)
    try {
      const day = dayAfter(todayYmdInAppTz(new Date(now())))
      const theJob = estimate ? estimate.jobId : jobId
      await io.addCall({
        contactId: contact.contactId,
        stepKey: MOMENT_STEP[moment],
        jobKey: theJob ? jobKey({ kind: 'pipeline', id: theJob }) : null,
        dueYmd: day,
        what: callWhat(MOMENT_STEP[moment], job?.jobName ?? null),
        script: receiptScript(moment, fills, 'en', callScript?.script ?? null),
      })
      showToast(CALL_WORDS.added(first, day), 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'The call was not added.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  if (view.kind === 'morning') {
    const footer = (
      <div style={footerRow}>
        <span />
        <button type="button" style={primaryBtn} onClick={onClose} data-testid="tell-done">
          {TELL_WORDS.done}
        </button>
      </div>
    )
    return (
      <ResponsiveModalShell title={TELL_WORDS.morningTitle} onRequestClose={onClose} footer={footer}>
        <div data-testid="tell-morning-receipt">
          <p style={bubble} data-testid="tell-receipt-words">
            {text.trim()}
          </p>
          <p style={muted} data-testid="tell-morning-line">
            {TELL_WORDS.morningLine(weekdayDate(view.day))}
          </p>
          <p style={muted}>{TELL_WORDS.morningWhere}</p>
        </div>
      </ResponsiveModalShell>
    )
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
          {view.email ? (
            <p style={mail} data-testid="tell-receipt-email">
              {emailSentLine(view.email, view.atMs)}
            </p>
          ) : null}
          {view.text ? (
            <>
              <p style={{ ...bubble, marginTop: view.email ? '0.5rem' : 0 }} data-testid="tell-receipt-words">
                {view.text}
              </p>
              <p style={muted} data-testid="tell-receipt-sent">
                {sentLine(first, view.atMs)}
              </p>
            </>
          ) : null}
          {callScript?.suggest === false ? null : (
            <>
              <p style={label}>{TELL_WORDS.callAsk(first)}</p>
              <p style={{ ...label, margin: '0 0 0.25rem', fontSize: '0.65rem' }}>{TELL_WORDS.whatToSay}</p>
              <p style={script} data-testid="tell-script">
                {receiptScript(moment, fills, 'en', callScript?.script ?? null)}
              </p>
              <p style={muted}>{TELL_WORDS.callLands(first)}</p>
              {contact ? (
                <button type="button" style={quietBtn} disabled={busy} onClick={() => void addCall()} data-testid="tell-add-call">
                  {CALL_WORDS.addToMyCalls}
                </button>
              ) : null}
            </>
          )}
        </div>
      </ResponsiveModalShell>
    )
  }

  const primary = hold && moment !== 'estimate' ? (
    <button type="button" style={secondaryBtn} onClick={onClose} data-testid="tell-primary">
      {a.primary}
    </button>
  ) : (
    <button type="button" style={canSend ? primaryBtn : { ...primaryBtn, ...disabled }} disabled={!canSend} title={left.length ? TELL_WORDS.blanksLeft(left) : undefined} onClick={() => void go(true)} data-testid="tell-primary">
      {busy ? TELL_WORDS.sending : a.primary}
    </button>
  )
  const footer = (
    <div style={footerRow}>
      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
        <button type="button" style={secondaryBtn} disabled={busy} onClick={onClose} data-testid="tell-skip">
          {a.skip}
        </button>
        {a.emailOnly && textCanGo ? (
          <button type="button" style={quietBtn} disabled={busy || loading} onClick={() => void go(false)} data-testid="tell-email-only">
            {a.emailOnly}
          </button>
        ) : null}
        {moment !== 'estimate' && textCanGo ? (
          <button type="button" style={quietBtn} disabled={!canSend} onClick={() => void morning()} data-testid="tell-morning">
            {TODAYS_SENDS_WORDS.sendInMorning}
          </button>
        ) : null}
      </div>
      {primary}
    </div>
  )

  const subline = estimate ? `${estimate.amount} · ${estimate.email}` : block ? `${fills.day ?? block.workDate} · ${fills.window ?? ''}${block.techName ? ` · ${block.techName}` : ''}` : ''

  return (
    <ResponsiveModalShell title={TELL_WORDS.title(first)} onRequestClose={() => !busy && onClose()} footer={footer}>
      <div data-testid="tell-sheet">
        <div style={who}>
          <span style={{ fontWeight: 700 }}>{jobLabel}</span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{subline}</span>
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
            {estimate ? (
              <div style={chan}>
                <span style={tickOn} aria-hidden>
                  ✓
                </span>
                <div>
                  <div style={{ fontWeight: 700 }}>{TELL_WORDS.emailTo(estimate.email)}</div>
                  <p style={{ ...mail, marginTop: '0.3rem' }} data-testid="tell-email">
                    {TELL_WORDS.emailWhat}
                  </p>
                </div>
              </div>
            ) : null}
            {textCanGo && number ? (
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
                  {moment === 'estimate' ? <p style={muted}>{TELL_WORDS.linkHint}</p> : null}
                </div>
              </div>
            ) : null}
            {!estimate ? (
              <div style={chan}>
                <span style={tick} aria-hidden />
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Email</div>
                  <p style={muted}>{TELL_WORDS.noEmail}</p>
                </div>
              </div>
            ) : null}
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
