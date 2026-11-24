/**
 * The window a paper's press opens (punch list #350): a Statement of account for a period, a Work statement for one
 * sheet or a Payment record for one sending, with a preview that is the paper itself, then Download, Print or Send.
 * One window for all three, opened from where the row already is: a sub's header, a sheet, a payment.
 *
 * `SubPapersWindowView` is the window over built inputs, so the same component is walked on made-up data.
 * `SubPapersWindow` (`SubPapersWindowConnected.tsx`) is the connected one: it reads the letterhead, draws the PDFs
 * with pdf-lib and files a sent copy.
 *
 * The train lands a step at a time, and the view draws only what its caller has: the payment record's pick shows
 * with `paymentRecords` (on since the payment record's own press landed), the send step with `canSend` and an `onSend`, and *Since the last statement* once a
 * `lastStatement` is handed in (null for a sub with none yet, absent while nothing records one).
 *
 * The send step (on since the Send press landed) says who it goes to, the message as the sub reads it, the files
 * and what the press does. It offers only the ways it is handed (`sendBy`): email is the one built. A sub with no
 * address has a dead press, the reason and the door its caller hands in (`emailDoor`). Papers past what one email
 * carries are held and named. Once it went, the step says so and offers Done in place of a second Send.
 *
 * A payment record's *Received* box reads the sub's own Got it marks once its caller hands them in (`answers`),
 * as the Pay view's chip does. The last press's line goes when the window moves to another paper or another step
 * (`subPaperSaid.ts`).
 *
 * The set is checked before any paper is drawn (`subPapersAddUp`). A set that does not add up shows what is off in
 * place of the paper, and its presses are dead.
 */
import { useMemo, useState, type CSSProperties } from 'react'
import {
  buildPaymentRecord,
  buildStatementOfAccount,
  buildWorkStatement,
  paperDay,
  paperMoney,
  paperSendings,
  paperSheetName,
  paperSheetSums,
  subPapersAddUp,
  SUB_PAPER_COUNSEL_PENDING,
  type PaperCompany,
  type PaperContext,
  type PaperSheet,
  type StatementRange,
} from '../../../supabase/functions/_shared/subPapers'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { PHONE_PRESS_MIN_HEIGHT } from '../../lib/phonePress'
import { paymentRecordReceived, type SubPaperAnswers } from '../../lib/subWorkOrders/subPaperAnswers'
import { subPaperPlace, subPaperSaidHeld, subPaperSaidShown } from '../../lib/subWorkOrders/subPaperSaid'
import { paymentRecordHtml, statementOfAccountHtml, SUB_PAPER_CSS, workStatementHtml } from '../../lib/subWorkOrders/subPapersHtml'
import { rosterEmailCheck, rosterEmailOffer, rosterEmailText } from '../../lib/subWorkOrders/subPaperRosterEmail'
import { subPaperSendParts, subPaperSendPlan, SUB_PAPER_SEND_BY, subPaperAttachmentName, type SubPaper, type SubPaperSendBy, type SubPaperSendPlan } from '../../lib/subWorkOrders/subPaperSend'
import { ledgerPeriodRange } from '../../lib/subWorkOrders/subPaymentsLedger'
import { formatErrorMessage } from '../../utils/errorHandling'
import { SCHEDULE_SHEET_Z } from '../schedule/ScheduleBlockSheet'
import { ChangeableValue } from '../valuesInPlace/ValuesInPlace'
import { MoneyText } from '../Money'

export type SubPapersOpen = { kind: 'statement' } | { kind: 'work'; sheetId: string } | { kind: 'payment'; sendingKey: string }

/** `emailUnread`: the roster could not be read just now, so the address is not known here. The function reads it itself. */
export type SubPaperContact = { email: string | null; phone: string | null; portalUrl: string | null; emailUnread?: boolean; /** The address on the login tied to their roster row. It is offered for a sub with none on the roster, never sent to unasked. */ loginEmail?: string | null }

type PeriodKey = 'since' | 'month' | 'year' | 'all' | 'custom'

/** Email is the one way built. A caller that has more hands them in. */
const EMAIL_ALONE: readonly SubPaperSendBy[] = ['email']

/** The door a dead Send needs: where an address is added, in words, and the press that opens it when the viewer can use it. */
export type SubPaperEmailDoor = { words: string; press?: { label: string; onPress: () => void } }

export type SubPapersWindowViewProps = {
  open: SubPapersOpen
  sheets: readonly PaperSheet[]
  ctx: PaperContext
  contact: SubPaperContact
  /** The last statement of account sent to this person, from the register; null before one has gone. Absent while no register records one: the period offers no *Since the last statement* then. */
  lastStatement?: { number: string; endedOn: string; /** When it was made. With it, a line typed since and dated inside that statement is carried into *Since the last statement*. */ madeAt?: string } | null
  /** A statement that ended today, from the register. It is said beside the period and does not move it. */
  statementToday?: { number: string } | null
  /** Offer a payment record beside the other two papers. */
  paymentRecords?: boolean
  /** What the sub said back from their page. A payment record says whether they marked it received. Absent where nothing reads the marks: every record then reads *Not marked yet*. */
  answers?: SubPaperAnswers
  /** The marks could not be read just now: a payment record still reads *Not marked yet*, and the window says that it could not tell. */
  marksUnread?: boolean
  canSend: boolean
  /** The ways a paper may go. Only what is built is handed in: a texted link is not, and the By row is left out when there is one way. */
  sendBy?: readonly SubPaperSendBy[]
  /** Where an email is added for a sub who has none, drawn under the reason the press is dead. */
  emailDoor?: SubPaperEmailDoor | null
  /**
   * Saves an address onto the person's roster row. With it the To line's address is changed in place, and a sub
   * with none has their door right there. Absent for a viewer who may not send. It throws with the reason when the
   * row does not take it.
   */
  onKeepEmail?: (email: string) => Promise<void>
  /** Start on the send step (the window after Record payment does). */
  startOnSend?: boolean
  busy?: string | null
  /** What the last press said back: a failure's reason, or what went. It is drawn until the window moves to another paper or another step. */
  said?: { tone: 'ok' | 'bad'; words: string } | null
  onDownload: (paper: SubPaper, range: StatementRange) => void
  onPrint: (paper: SubPaper, range: StatementRange) => void
  /** Absent where nothing sends: the window then makes, prints and downloads only. It answers true once the papers went, and the step then offers Done. */
  onSend?: (plan: SubPaperSendPlan, papers: SubPaper[], by: SubPaperSendBy, range: StatementRange) => void | Promise<boolean>
  onClose: () => void
}

const quietAtDesk: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, padding: '0.35rem 0.8rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer', whiteSpace: 'nowrap' }
const pressAtDesk = (live: boolean): CSSProperties => ({ font: 'inherit', fontSize: '0.8125rem', fontWeight: 650, padding: '0.35rem 0.9rem', borderRadius: 6, border: 'none', background: live ? '#2563eb' : DEAD_PRESS_FILL, color: live ? 'white' : DEAD_PRESS_TEXT, cursor: live ? 'pointer' : 'default', whiteSpace: 'nowrap' })
const segAtDesk = (on: boolean): CSSProperties => ({ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '0.22rem 0.7rem', borderRadius: 999, border: `1px solid ${on ? 'var(--border-blue)' : 'var(--border)'}`, background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', color: on ? 'var(--text-blue-700)' : 'var(--text-700)', cursor: 'pointer' })
const k: CSSProperties = { fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-faint)', marginBottom: 3 }
const field: CSSProperties = { marginTop: 10 }
/** On a phone every press in the window stands a fingertip tall, its words in the middle. The desk keeps its sizes. */
const thumb: CSSProperties = { minHeight: PHONE_PRESS_MIN_HEIGHT, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }
/** A tick box's row on a phone: the whole line is the press, a fingertip tall. */
const thumbTick: CSSProperties = { minHeight: PHONE_PRESS_MIN_HEIGHT, display: 'flex', alignItems: 'center', gap: 6 }

export function SubPapersWindowView({ open, sheets, ctx, contact, lastStatement: lastStatementNow, statementToday: statementTodayNow = null, paymentRecords = false, answers, marksUnread = false, canSend: maySend, sendBy = EMAIL_ALONE, emailDoor = null, onKeepEmail, startOnSend = false, busy = null, said = null, onDownload, onPrint, onSend, onClose }: SubPapersWindowViewProps) {
  const canSend = maySend && !!onSend
  const phone = useNarrowViewport640()
  const quiet: CSSProperties = phone ? { ...quietAtDesk, ...thumb } : quietAtDesk
  const press = (live: boolean): CSSProperties => (phone ? { ...pressAtDesk(live), ...thumb } : pressAtDesk(live))
  const seg = (on: boolean): CSSProperties => (phone ? { ...segAtDesk(on), ...thumb } : segAtDesk(on))
  /** A list to pick from keeps its own box: it is a fingertip tall on a phone and is not laid out as a row. */
  const pick = (on: boolean): CSSProperties => ({ ...segAtDesk(on), paddingRight: '0.4rem', maxWidth: '100%', ...(phone ? { minHeight: PHONE_PRESS_MIN_HEIGHT, boxSizing: 'border-box' } : {}) })
  const [view, setView] = useState<SubPapersOpen>(open)
  const [step, setStep] = useState<'paper' | 'send'>(startOnSend && canSend ? 'send' : 'paper')
  /** The papers went on this visit to the send step: it offers Done, never a second Send by mistake. */
  const [went, setWent] = useState(false)
  /** Why the sign-in address did not go onto the roster row, said beside its press. */
  const [offerWhy, setOfferWhy] = useState<string | null>(null)
  const [offerBusy, setOfferBusy] = useState(false)
  /** Which email of the send is open, from 0. A pick past one email's limit goes in several, and each has its own send. */
  const [email, setEmail] = useState(0)
  // The last statement as it stood when the window opened. A paper made here is registered at once, and it must
  // not move this window's own period under the person: a second press sends the period they are looking at.
  const [lastStatement] = useState(lastStatementNow)
  const [statementToday] = useState(statementTodayNow)
  const [period, setPeriod] = useState<PeriodKey>(lastStatement ? 'since' : 'all')
  const [custom, setCustom] = useState<{ from: string; to: string }>({ from: '', to: ctx.today })
  const [attachOpen, setAttachOpen] = useState(true)
  const [attachPayments, setAttachPayments] = useState(false)
  const ways = SUB_PAPER_SEND_BY.filter((o) => sendBy.includes(o.key))
  const [by, setBy] = useState<SubPaperSendBy>(ways[0]?.key ?? 'email')
  // The last press's line belongs to the paper and the step it arrived on, so it goes when either changes.
  const place = subPaperPlace(view, step, email)
  const [saidHeld, setSaidHeld] = useState(() => subPaperSaidHeld(null, said, place))
  const saidNow = subPaperSaidHeld(saidHeld, said, place)
  if (saidNow !== saidHeld) setSaidHeld(saidNow)
  const saidShown = subPaperSaidShown(saidNow)

  const range: StatementRange = useMemo(() => {
    // A period never starts after it ends: a last statement that ended today or later leaves the statement to date.
    if (period === 'since') return lastStatement && nextDay(lastStatement.endedOn) <= ctx.today ? { from: nextDay(lastStatement.endedOn), to: ctx.today, lateAfter: lastStatement.madeAt ?? null } : { from: null, to: null }
    if (period === 'all') return { from: null, to: null }
    if (period === 'custom') return { from: custom.from || null, to: custom.to || null }
    // The ledger's month and year run to the period's last day as a filter. A paper closes on a real day, today at the latest.
    const r = ledgerPeriodRange(period, ctx.today)
    return { from: r.from, to: r.to && r.to > ctx.today ? ctx.today : r.to }
  }, [period, custom, lastStatement, ctx.today])

  // Every paper of this person's, built once: the check runs across all of them.
  const built = useMemo(() => {
    const work = sheets.map((s) => buildWorkStatement(s, ctx))
    const sendings = paperSendings(sheets)
    // The sub's own mark, as the Pay view's chip reads it: without it every record would say *Not marked yet*.
    const payments = sendings.map((s) => buildPaymentRecord(s, sheets, ctx, answers ? paymentRecordReceived(answers, s.key) : null))
    const everyDate = buildStatementOfAccount(sheets, { from: null, to: null }, ctx)
    return { work, payments, sendings, check: subPapersAddUp({ statement: everyDate, work, payments }) }
  }, [sheets, ctx, answers])
  const statement = useMemo(() => buildStatementOfAccount(sheets, range, ctx), [sheets, range, ctx])

  const paper: SubPaper | null = view.kind === 'statement' ? statement : view.kind === 'work' ? (built.work.find((w) => w.sheetId === view.sheetId) ?? null) : (built.payments.find((p) => p.key === view.sendingKey) ?? null)
  const html = !paper ? '' : paper.kind === 'statement_of_account' ? statementOfAccountHtml(paper, range) : paper.kind === 'work_statement' ? workStatementHtml(paper) : paymentRecordHtml(paper)

  const openWork = built.work.filter((w) => w.stillOpen > 0)
  const periodPayments = built.payments.filter((p) => statement.lastPayments.some((l) => l.key === p.key))
  // One email carries so many papers. The oldest ride first, and what does not fit is held, named and given the
  // next email: the step sends one email at a time, and a held paper has a press of its own.
  const picked: SubPaper[] = view.kind === 'statement' ? [...(attachOpen ? openWork : []), ...(attachPayments ? periodPayments : [])] : []
  const parts = !paper ? [] : by === 'email' ? subPaperSendParts(paper, picked) : [[paper, ...picked]]
  const emailAt = Math.min(email, Math.max(0, parts.length - 1))
  const sending = parts[emailAt] ?? []
  const lead = sending[0] ?? null
  const attached = sending.slice(1)
  const held = parts.slice(emailAt + 1).flat()
  const last = built.sendings[built.sendings.length - 1]
  const plan = lead ? subPaperSendPlan({ company: ctx.company.name, subName: ctx.sub.name, lead, attached, held, part: { n: emailAt + 1, of: parts.length }, by, email: contact.email, emailUnread: contact.emailUnread, phone: contact.phone, portalUrl: contact.portalUrl, lastPayment: last ? { amount: last.amount, day: paperDay(last.ymd) || 'a day not recorded' } : null }) : null
  const texts = ways.some((o) => o.key === 'text')
  // The To line takes an address only from a viewer who may send: the same people the function sends for.
  const keepEmail = canSend ? onKeepEmail : undefined
  // A roster that could not be read may hold an address, so nothing is offered over it.
  const offer = contact.emailUnread ? null : rosterEmailOffer({ rosterEmail: contact.email, loginEmail: contact.loginEmail })
  // A press under way keeps the window: its answer is said here, and a window closed and opened again could send twice.
  const closeUnlessBusy = () => {
    if (!busy) onClose()
  }
  /** The held papers' email: the step moves on to it, and what went or did not stays with the email before. */
  const openNextEmail = () => {
    setWent(false)
    setEmail(emailAt + 1)
  }
  const ok = built.check.ok && !!paper
  const unnumbered = sheets.filter((s) => !s.number).length
  const backcharges = sheets.reduce((n, s) => n + s.money.filter((m) => m.amount < 0 && statement.rows.some((r) => r.sheetId === s.id)).length, 0)

  return (
    // Above the phone's sheet: on a phone People → Subs opens this window from a press inside *What we owe*, and under the sheet every press here was covered.
    <div role="presentation" onClick={closeUnlessBusy} style={{ position: 'fixed', inset: 0, zIndex: SCHEDULE_SHEET_Z + 1, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 'calc(1rem + var(--app-top-chrome, 0px)) 0.75rem 1rem', overflowY: 'auto' }}>
      <div role="dialog" aria-modal="true" aria-label={`Papers for ${ctx.sub.name}`} onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text-700)', borderRadius: 10, padding: '1rem 1.1rem', width: 'min(820px, 100%)', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.3rem 0.8rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-strong)' }}>
            {step === 'send' ? (emailAt > 0 ? `Send more papers · email ${emailAt + 1} of ${parts.length}` : `Send ${paper?.kind === 'statement_of_account' ? 'the statement of account' : paper?.kind === 'payment_record' ? 'the payment record' : 'the work statement'}`) : `${paper?.title ?? 'Papers'} · ${ctx.sub.name}`}
          </h3>
          <button type="button" disabled={!!busy} onClick={closeUnlessBusy} style={{ ...quiet, marginLeft: 'auto', opacity: busy ? 0.55 : 1 }}>
            Close
          </button>
        </div>

        {step === 'paper' ? (
          <div role="group" aria-label="Which paper" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            <button type="button" aria-pressed={view.kind === 'statement'} style={seg(view.kind === 'statement')} onClick={() => setView({ kind: 'statement' })}>
              Statement of account
            </button>
            <select aria-label="A work statement" value={view.kind === 'work' ? view.sheetId : ''} onChange={(e) => e.target.value && setView({ kind: 'work', sheetId: e.target.value })} style={pick(view.kind === 'work')}>
              <option value="">Work statements · {built.work.length}</option>
              {sheets.map((s) => (
                <option key={s.id} value={s.id}>
                  {paperSheetName(s)} · {s.jobName || s.address} · {paperMoney(paperSheetSums(s).stillOpen)} open
                </option>
              ))}
            </select>
{paymentRecords ? (
                          <select aria-label="A payment record" value={view.kind === 'payment' ? view.sendingKey : ''} onChange={(e) => e.target.value && setView({ kind: 'payment', sendingKey: e.target.value })} style={pick(view.kind === 'payment')}>
                <option value="">Payment records · {built.payments.length}</option>
                {built.payments
                  .slice()
                  .reverse()
                  .map((p) => (
                    <option key={p.key} value={p.key}>
                      {[p.number, p.sentOn, paperMoney(p.amountSent)].filter(Boolean).join(' · ')}
                    </option>
                  ))}
              </select>
            ) : null}
          </div>
        ) : null}

        {!built.check.ok ? (
          <div role="alert" data-testid="sub-papers-refused" style={{ marginTop: 12, padding: '0.6rem 0.8rem', borderRadius: 8, border: '1px solid var(--border-red, var(--text-red-700))', background: 'var(--bg-red-tint)', color: 'var(--text-red-700)', fontSize: '0.8125rem' }}>
            <b>These papers do not add up, so none is drawn.</b>
            <ul style={{ margin: '0.3rem 0 0 1.1rem', padding: 0 }}>
              {built.check.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {step === 'paper' && view.kind === 'statement' ? (
          <>
            <div style={field}>
              <div style={k}>Period</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(
                  [
                    ['since', 'Since the last statement'],
                    ['month', 'This month'],
                    ['year', 'This year'],
                    ['all', 'To date'],
                    ['custom', 'Pick dates'],
                  ] as Array<[PeriodKey, string]>
                )
                  .filter(([key]) => key !== 'since' || lastStatement !== undefined)
                  .map(([key, label]) => (
                  <button key={key} type="button" aria-pressed={period === key} disabled={key === 'since' && !lastStatement} title={key === 'since' && !lastStatement ? (statementToday ? 'Their first statement was made today' : 'No statement has been sent to them yet') : undefined} style={{ ...seg(period === key), opacity: key === 'since' && !lastStatement ? 0.55 : 1 }} onClick={() => setPeriod(key)}>
                    {label}
                  </button>
                ))}
              </div>
              {period === 'custom' ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6, fontSize: '0.8125rem' }}>
                  <label>
                    From <input type="date" value={custom.from} max={custom.to || ctx.today} onChange={(e) => setCustom({ ...custom, from: e.target.value })} style={{ fontFamily: 'inherit' }} />
                  </label>
                  <label>
                    To <input type="date" value={custom.to} max={ctx.today} onChange={(e) => setCustom({ ...custom, to: e.target.value })} style={{ fontFamily: 'inherit' }} />
                  </label>
                </div>
              ) : null}
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                {statement.period}.
                {lastStatement
                  ? statementToday
                    ? ` ${statementToday.number} was made today. The statement before it, ${lastStatement.number}, ended ${paperDay(lastStatement.endedOn)}.`
                    : ` The last statement, ${lastStatement.number}, ended ${paperDay(lastStatement.endedOn)}.`
                  : lastStatement === null
                    ? statementToday
                      ? ` ${statementToday.number} was made today and is their first, so this one runs to date as well.`
                      : ' This is their first statement, so it runs to date.'
                    : ''}
              </div>
            </div>
            <div style={field}>
              <div style={k}>What it will show</div>
              <div data-testid="sub-papers-will-show" style={{ fontSize: '0.8125rem', padding: '0.45rem 0.65rem', background: 'var(--bg-page)', borderRadius: 6 }}>
                {statement.rows.length} work {statement.rows.length === 1 ? 'statement' : 'statements'} · {statement.lastPayments.length} {statement.lastPayments.length === 1 ? 'payment' : 'payments'} · {backcharges} {backcharges === 1 ? 'back-charge' : 'back-charges'} · <b><MoneyText text={paperMoney(statement.stillOpen)} /> still open</b>
                {lastStatement === undefined ? (
                  unnumbered > 0 ? <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{unnumbered === sheets.length ? 'No work statement carries a number yet. Each paper says the day and time it was prepared.' : `${unnumbered} ${unnumbered === 1 ? 'sheet has' : 'sheets have'} no work statement number yet.`}</div> : null
                ) : (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    This statement takes its number when you print, download or send it.{unnumbered > 0 ? ` ${unnumbered} ${unnumbered === 1 ? 'sheet has' : 'sheets have'} no work statement yet, and each takes its number the first time its paper is made.` : ''}
                  </div>
                )}
              </div>
            </div>
{canSend ? (
                        <div style={field}>
                <div style={k}>Attach</div>
                <label style={{ fontSize: '0.8125rem', marginRight: 14, ...(phone ? thumbTick : {}) }}>
                  <input type="checkbox" checked={attachOpen} onChange={(e) => setAttachOpen(e.target.checked)} /> Each open work statement ({openWork.length})
                </label>
                <label style={{ fontSize: '0.8125rem', ...(phone ? thumbTick : {}) }}>
                  <input type="checkbox" checked={attachPayments} onChange={(e) => setAttachPayments(e.target.checked)} /> Payment records in the period ({periodPayments.length})
                </label>
              </div>
            ) : null}
          </>
        ) : null}

        {step === 'paper' && ok ? (
          <div style={field}>
            <div style={k}>Preview · this is the paper</div>
            <div data-theme="light" data-testid="sub-paper-preview" style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', maxHeight: '52vh', overflow: 'auto' }}>
              <style>{SUB_PAPER_CSS}</style>
              {/* The print page itself: `subPapersHtml.ts` escapes every word it is handed. */}
              {/* eslint-disable-next-line react/no-danger */}
              <div dangerouslySetInnerHTML={{ __html: html }} />
            </div>
            {SUB_PAPER_COUNSEL_PENDING ? <div style={{ fontSize: '0.75rem', color: 'var(--text-violet-700)', marginTop: 4 }}>§ The boxed sentences are draft wording. They wait on counsel, and every copy prints them marked.</div> : null}
            {marksUnread && paper?.kind === 'payment_record' ? <div data-testid="sub-papers-marks-unread" style={{ fontSize: '0.75rem', color: 'var(--text-amber-900)', marginTop: 4 }}>Whether {ctx.sub.name} pressed Got it could not be read just now. This paper says Not marked yet either way.</div> : null}
          </div>
        ) : null}

        {step === 'send' && plan && lead ? (
          <>
            <div style={field}>
              <div style={k}>To</div>
              <div data-testid="sub-papers-to" style={{ fontSize: '0.8125rem', padding: '0.4rem 0.6rem', border: '1px solid var(--border)', borderRadius: 6 }}>
                {ctx.sub.name}
                {' · '}
                {/* The address is the roster's own, changed where it sits. One that could not be read is not offered: what it holds is not known here. */}
                {keepEmail && !contact.emailUnread ? (
                  <ChangeableValue text={rosterEmailText(contact.email)} label={`${ctx.sub.name}’s email`} type="text" value={contact.email ?? ''} check={rosterEmailCheck} hint="Their papers go to this address. It is saved on their roster row." off={!!busy} onKeep={(typed) => keepEmail(typed)} />
                ) : (
                  (contact.email ?? (contact.emailUnread ? 'the address on their roster row' : 'no email on the roster'))
                )}
                {texts ? ` · ${contact.phone ?? 'no phone on the roster'}` : ''}
              </div>
              {keepEmail && offer ? (
                <div data-testid="sub-papers-login-email" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  {offer.words}{' '}
                  <button
                    type="button"
                    disabled={offerBusy || !!busy}
                    onClick={() => {
                      setOfferBusy(true)
                      setOfferWhy(null)
                      keepEmail(offer.email).then(
                        () => setOfferBusy(false),
                        (err: unknown) => {
                          setOfferBusy(false)
                          setOfferWhy(formatErrorMessage(err))
                        },
                      )
                    }}
                    style={{ fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 650, padding: 0, border: 'none', background: 'none', color: 'var(--text-blue-700)', textDecoration: 'underline', cursor: offerBusy || busy ? 'default' : 'pointer', ...(phone ? { minHeight: PHONE_PRESS_MIN_HEIGHT } : {}) }}
                  >
                    {offer.label}
                  </button>
                  {offerWhy ? (
                    <span role="alert" style={{ color: 'var(--text-red-700)' }}>
                      {' '}
                      {offerWhy}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
            {ways.length > 1 ? (
              <div style={field}>
                <div style={k}>By</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {ways.map((o) => (
                    <button key={o.key} type="button" aria-pressed={by === o.key} style={seg(by === o.key)} onClick={() => setBy(o.key)}>
                      {o.label}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>{ways.find((o) => o.key === by)?.hint}</div>
              </div>
            ) : null}
            <div style={field}>
              <div style={k}>They will get</div>
              <div data-testid="sub-papers-message" style={{ fontSize: '0.8125rem', padding: '0.5rem 0.7rem', background: 'var(--bg-page)', borderRadius: 6 }}>
                {by === 'email' ? (
                  <>
                    <b>{plan.subject}</b>
                    <div style={{ marginTop: 3 }}>{plan.body}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                      {plan.files.map((f) => (
                        <span key={f} style={{ fontSize: '0.75rem', border: '1px solid var(--border)', borderRadius: 6, padding: '0.1rem 0.45rem', background: 'var(--surface)' }}>
                          📎 {f}
                        </span>
                      ))}
                    </div>
                    {/* Where the register is live, a paper with no number yet takes one as it is made, and its file is named for it. */}
                    {lastStatement !== undefined && sending.some((p) => !p.number && p.kind !== 'payment_record') ? <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>A paper with no number yet takes one as it is made, and its file is named for it.{emailAt === 0 && lead.kind === 'work_statement' && !lead.number ? ' The subject names it too.' : ''}</div> : null}
                  </>
                ) : (
                  plan.text
                )}
              </div>
            </div>
            {/* A press that cannot go lists nothing it would do: the reason under it is the whole story. */}
            {plan.blocked ? null : (
              <div style={{ ...field, fontSize: '0.8125rem', padding: '0.5rem 0.7rem', border: '1px solid var(--border)', borderRadius: 6 }}>
                <b>When you press {by === 'link' ? 'Copy' : 'Send'}</b>
                <ol style={{ margin: '0.25rem 0 0 1.1rem', padding: 0 }}>
                  {plan.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </div>
            )}
            {plan.held ? (
              <div data-testid="sub-papers-held" style={{ ...field, fontSize: '0.8125rem', color: 'var(--text-amber-900)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', borderRadius: 6, padding: '0.45rem 0.65rem' }}>
                {plan.held}
                {/* The held papers' own door before this email went: nothing sends them otherwise. Once it went, the press below leads. */}
                {plan.next && !went ? (
                  <div style={{ marginTop: 4 }}>
                    <button type="button" data-testid="sub-papers-next-email" disabled={!!busy} onClick={openNextEmail} style={{ fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 650, padding: 0, border: 'none', background: 'none', color: 'inherit', textDecoration: 'underline', cursor: busy ? 'default' : 'pointer', ...(phone ? { minHeight: PHONE_PRESS_MIN_HEIGHT } : {}) }}>
                      {plan.next}
                    </button>
                    {' This email is not sent by that press.'}
                  </div>
                ) : null}
              </div>
            ) : null}
            {plan.blocked ? (
              <div role="alert" style={{ ...field, fontSize: '0.8125rem', color: 'var(--text-amber-900)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', borderRadius: 6, padding: '0.45rem 0.65rem' }}>
                {plan.blocked}
                {plan.needs === 'email' && emailDoor ? (
                  <>
                    {' '}
                    {emailDoor.words}
                    {emailDoor.press ? (
                      <>
                        {' '}
                        <button type="button" onClick={emailDoor.press.onPress} style={{ fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 650, padding: 0, border: 'none', background: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', ...(phone ? { minHeight: PHONE_PRESS_MIN_HEIGHT } : {}) }}>
                          {emailDoor.press.label}
                        </button>
                      </>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}

        {saidShown ? (
          <div role={saidShown.tone === 'bad' ? 'alert' : 'status'} style={{ ...field, fontSize: '0.8125rem', color: saidShown.tone === 'bad' ? 'var(--text-red-700)' : 'var(--text-green-700)' }}>
            {saidShown.words}
          </div>
        ) : null}

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          {step === 'send' ? (
            <>
              <button
                type="button"
                style={quiet}
                onClick={() => {
                  setWent(false)
                  setEmail(0)
                  setStep('paper')
                }}
              >
                Back to the paper
              </button>
              {went && plan?.next ? (
                // More is held: the next email leads, and Done is still there for an office that stops here.
                <>
                  <button type="button" style={quiet} onClick={onClose}>
                    Done
                  </button>
                  <button type="button" style={press(true)} onClick={openNextEmail}>
                    {plan.next}
                  </button>
                </>
              ) : went ? (
                <button type="button" style={press(true)} onClick={onClose}>
                  Done
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!ok || !plan?.confirmLabel || !canSend || !!busy}
                  style={press(ok && !!plan?.confirmLabel && canSend && !busy)}
                  onClick={() => {
                    if (!plan || !lead) return
                    void Promise.resolve(onSend?.(plan, sending, by, range)).then((sent) => {
                      if (sent === true) setWent(true)
                    })
                  }}
                >
                  {busy ?? plan?.confirmLabel ?? 'Cannot send yet'}
                </button>
              )}
            </>
          ) : (
            <>
              <button type="button" disabled={!ok || !!busy} style={{ ...quiet, opacity: ok ? 1 : 0.55 }} onClick={() => paper && onPrint(paper, range)}>
                Print
              </button>
              <button type="button" disabled={!ok || !!busy} style={{ ...quiet, opacity: ok ? 1 : 0.55 }} onClick={() => paper && onDownload(paper, range)}>
                {busy ?? 'Download the PDF'}
              </button>
              {canSend ? (
                <button type="button" disabled={!ok} style={press(ok)} onClick={() => setStep('send')}>
                  Send to {ctx.sub.name}…
                </button>
              ) : null}
            </>
          )}
        </div>
        {paper && step === 'paper' ? (
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6, textAlign: 'right' }}>
            {/* Where the register is live, a paper with no number yet takes one as it is made, and its file is named for it. */}
            {lastStatement !== undefined && !paper.number && paper.kind !== 'payment_record' ? 'The file is named for the paper’s number, given as it is made.' : `The file is ${subPaperAttachmentName(paper)}`}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * What a paper's press draws while the letterhead and the register are read: the window's own frame, with Close.
 * Until this the press drew nothing for as long as the reads took, and looked dead on a slow line.
 */
export function SubPapersWaiting({ name, onClose }: { name: string; onClose: () => void }) {
  const phone = useNarrowViewport640()
  const quiet: CSSProperties = phone ? { ...quietAtDesk, ...thumb } : quietAtDesk
  return (
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: SCHEDULE_SHEET_Z + 1, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 'calc(1rem + var(--app-top-chrome, 0px)) 0.75rem 1rem', overflowY: 'auto' }}>
      <div role="dialog" aria-modal="true" aria-busy="true" aria-label={`Papers for ${name}`} onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text-700)', borderRadius: 10, padding: '1rem 1.1rem', width: 'min(820px, 100%)', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.3rem 0.8rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-strong)' }}>Papers · {name}</h3>
          <button type="button" onClick={onClose} style={{ ...quiet, marginLeft: 'auto' }}>
            Close
          </button>
        </div>
        <div role="status" data-testid="sub-papers-waiting" style={{ marginTop: 12, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Getting the papers ready…
        </div>
      </div>
    </div>
  )
}

function nextDay(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const t = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + 1))
  return t.toISOString().slice(0, 10)
}

export type { PaperCompany }
