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
 * with `paymentRecords`, the send step with `canSend` and an `onSend`, and *Since the last statement* once a
 * `lastStatement` is handed in (null for a sub with none yet, absent while nothing records one).
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
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { paymentRecordHtml, statementOfAccountHtml, SUB_PAPER_CSS, workStatementHtml } from '../../lib/subWorkOrders/subPapersHtml'
import { subPaperSendPlan, SUB_PAPER_SEND_BY, subPaperAttachmentName, type SubPaper, type SubPaperSendBy, type SubPaperSendPlan } from '../../lib/subWorkOrders/subPaperSend'
import { ledgerPeriodRange } from '../../lib/subWorkOrders/subPaymentsLedger'

export type SubPapersOpen = { kind: 'statement' } | { kind: 'work'; sheetId: string } | { kind: 'payment'; sendingKey: string }

export type SubPaperContact = { email: string | null; phone: string | null; portalUrl: string | null }

type PeriodKey = 'since' | 'month' | 'year' | 'all' | 'custom'

export type SubPapersWindowViewProps = {
  open: SubPapersOpen
  sheets: readonly PaperSheet[]
  ctx: PaperContext
  contact: SubPaperContact
  /** The last statement of account sent to this person, from the register; null before one has gone. Absent while no register records one: the period offers no *Since the last statement* then. */
  lastStatement?: { number: string; endedOn: string } | null
  /** Offer a payment record beside the other two papers. Off until the payment record's own press lands. */
  paymentRecords?: boolean
  canSend: boolean
  /** Start on the send step (the window after Record payment does). */
  startOnSend?: boolean
  busy?: string | null
  /** What the last press said back: a failure's reason, or what went. */
  said?: { tone: 'ok' | 'bad'; words: string } | null
  onDownload: (paper: SubPaper, range: StatementRange) => void
  onPrint: (paper: SubPaper, range: StatementRange) => void
  /** Absent until Send lands: the window then makes, prints and downloads only. */
  onSend?: (plan: SubPaperSendPlan, papers: SubPaper[], by: SubPaperSendBy, range: StatementRange) => void
  onClose: () => void
}

const quiet: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, padding: '0.35rem 0.8rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer', whiteSpace: 'nowrap' }
const press = (live: boolean): CSSProperties => ({ font: 'inherit', fontSize: '0.8125rem', fontWeight: 650, padding: '0.35rem 0.9rem', borderRadius: 6, border: 'none', background: live ? '#2563eb' : DEAD_PRESS_FILL, color: live ? 'white' : DEAD_PRESS_TEXT, cursor: live ? 'pointer' : 'default', whiteSpace: 'nowrap' })
const seg = (on: boolean): CSSProperties => ({ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '0.22rem 0.7rem', borderRadius: 999, border: `1px solid ${on ? 'var(--border-blue)' : 'var(--border)'}`, background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', color: on ? 'var(--text-blue-700)' : 'var(--text-700)', cursor: 'pointer' })
const k: CSSProperties = { fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-faint)', marginBottom: 3 }
const field: CSSProperties = { marginTop: 10 }

export function SubPapersWindowView({ open, sheets, ctx, contact, lastStatement, paymentRecords = false, canSend: maySend, startOnSend = false, busy = null, said = null, onDownload, onPrint, onSend, onClose }: SubPapersWindowViewProps) {
  const canSend = maySend && !!onSend
  const [view, setView] = useState<SubPapersOpen>(open)
  const [step, setStep] = useState<'paper' | 'send'>(startOnSend && canSend ? 'send' : 'paper')
  const [period, setPeriod] = useState<PeriodKey>(lastStatement ? 'since' : 'all')
  const [custom, setCustom] = useState<{ from: string; to: string }>({ from: '', to: ctx.today })
  const [attachOpen, setAttachOpen] = useState(true)
  const [attachPayments, setAttachPayments] = useState(false)
  const [by, setBy] = useState<SubPaperSendBy>('email')

  const range: StatementRange = useMemo(() => {
    if (period === 'since') return lastStatement ? { from: nextDay(lastStatement.endedOn), to: ctx.today } : { from: null, to: null }
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
    const payments = sendings.map((s) => buildPaymentRecord(s, sheets, ctx))
    const everyDate = buildStatementOfAccount(sheets, { from: null, to: null }, ctx)
    return { work, payments, sendings, check: subPapersAddUp({ statement: everyDate, work, payments }) }
  }, [sheets, ctx])
  const statement = useMemo(() => buildStatementOfAccount(sheets, range, ctx), [sheets, range, ctx])

  const paper: SubPaper | null = view.kind === 'statement' ? statement : view.kind === 'work' ? (built.work.find((w) => w.sheetId === view.sheetId) ?? null) : (built.payments.find((p) => p.key === view.sendingKey) ?? null)
  const html = !paper ? '' : paper.kind === 'statement_of_account' ? statementOfAccountHtml(paper, range) : paper.kind === 'work_statement' ? workStatementHtml(paper) : paymentRecordHtml(paper)

  const openWork = built.work.filter((w) => w.stillOpen > 0)
  const periodPayments = built.payments.filter((p) => statement.lastPayments.some((l) => l.key === p.key))
  const attached: SubPaper[] = view.kind === 'statement' ? [...(attachOpen ? openWork : []), ...(attachPayments ? periodPayments : [])] : []
  const last = built.sendings[built.sendings.length - 1]
  const plan = paper ? subPaperSendPlan({ company: ctx.company.name, subName: ctx.sub.name, lead: paper, attached, by, email: contact.email, phone: contact.phone, portalUrl: contact.portalUrl, lastPayment: last ? { amount: last.amount, day: paperDay(last.ymd) || 'a day not recorded' } : null }) : null
  const ok = built.check.ok && !!paper
  const unnumbered = sheets.filter((s) => !s.number).length
  const backcharges = sheets.reduce((n, s) => n + s.money.filter((m) => m.amount < 0 && statement.rows.some((r) => r.sheetId === s.id)).length, 0)

  return (
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1002, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 'calc(1rem + var(--app-top-chrome, 0px)) 0.75rem 1rem', overflowY: 'auto' }}>
      <div role="dialog" aria-modal="true" aria-label={`Papers for ${ctx.sub.name}`} onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text-700)', borderRadius: 10, padding: '1rem 1.1rem', width: 'min(820px, 100%)', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.3rem 0.8rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-strong)' }}>
            {step === 'send' ? `Send ${paper?.kind === 'statement_of_account' ? 'the statement of account' : paper?.kind === 'payment_record' ? 'the payment record' : 'the work statement'}` : `${paper?.title ?? 'Papers'} · ${ctx.sub.name}`}
          </h3>
          <button type="button" onClick={onClose} style={{ ...quiet, marginLeft: 'auto' }}>
            Close
          </button>
        </div>

        {step === 'paper' ? (
          <div role="group" aria-label="Which paper" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            <button type="button" aria-pressed={view.kind === 'statement'} style={seg(view.kind === 'statement')} onClick={() => setView({ kind: 'statement' })}>
              Statement of account
            </button>
            <select aria-label="A work statement" value={view.kind === 'work' ? view.sheetId : ''} onChange={(e) => e.target.value && setView({ kind: 'work', sheetId: e.target.value })} style={{ ...seg(view.kind === 'work'), paddingRight: '0.4rem', maxWidth: '100%' }}>
              <option value="">Work statements · {built.work.length}</option>
              {sheets.map((s) => (
                <option key={s.id} value={s.id}>
                  {paperSheetName(s)} · {s.jobName || s.address} · {paperMoney(paperSheetSums(s).stillOpen)} open
                </option>
              ))}
            </select>
{paymentRecords ? (
                          <select aria-label="A payment record" value={view.kind === 'payment' ? view.sendingKey : ''} onChange={(e) => e.target.value && setView({ kind: 'payment', sendingKey: e.target.value })} style={{ ...seg(view.kind === 'payment'), paddingRight: '0.4rem', maxWidth: '100%' }}>
                <option value="">Payment records · {built.payments.length}</option>
                {built.payments
                  .slice()
                  .reverse()
                  .map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.number || 'No number'} · {p.sentOn} · {paperMoney(p.amountSent)}
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
                  <button key={key} type="button" aria-pressed={period === key} disabled={key === 'since' && !lastStatement} title={key === 'since' && !lastStatement ? 'No statement has been sent to them yet' : undefined} style={{ ...seg(period === key), opacity: key === 'since' && !lastStatement ? 0.55 : 1 }} onClick={() => setPeriod(key)}>
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
                {lastStatement ? ` The last statement, ${lastStatement.number}, ended ${paperDay(lastStatement.endedOn)}.` : lastStatement === null ? ' This is their first statement, so it runs to date.' : ''}
              </div>
            </div>
            <div style={field}>
              <div style={k}>What it will show</div>
              <div data-testid="sub-papers-will-show" style={{ fontSize: '0.8125rem', padding: '0.45rem 0.65rem', background: 'var(--bg-page)', borderRadius: 6 }}>
                {statement.rows.length} work {statement.rows.length === 1 ? 'statement' : 'statements'} · {statement.lastPayments.length} {statement.lastPayments.length === 1 ? 'payment' : 'payments'} · {backcharges} {backcharges === 1 ? 'back-charge' : 'back-charges'} · <b>{paperMoney(statement.stillOpen)} still open</b>
                {unnumbered > 0 ? <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{unnumbered === sheets.length ? 'No paper carries a number yet. Each one says the day and time it was prepared.' : `${unnumbered} ${unnumbered === 1 ? 'sheet has' : 'sheets have'} no work statement number yet.`}</div> : null}
              </div>
            </div>
{canSend ? (
                        <div style={field}>
                <div style={k}>Attach</div>
                <label style={{ fontSize: '0.8125rem', marginRight: 14 }}>
                  <input type="checkbox" checked={attachOpen} onChange={(e) => setAttachOpen(e.target.checked)} /> Each open work statement ({openWork.length})
                </label>
                <label style={{ fontSize: '0.8125rem' }}>
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
          </div>
        ) : null}

        {step === 'send' && plan && paper ? (
          <>
            <div style={field}>
              <div style={k}>To</div>
              <div style={{ fontSize: '0.8125rem', padding: '0.4rem 0.6rem', border: '1px solid var(--border)', borderRadius: 6 }}>{[ctx.sub.name, contact.email ?? 'no email on the roster', contact.phone ?? 'no phone on the roster'].join(' · ')}</div>
            </div>
            <div style={field}>
              <div style={k}>By</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {SUB_PAPER_SEND_BY.map((o) => (
                  <button key={o.key} type="button" aria-pressed={by === o.key} style={seg(by === o.key)} onClick={() => setBy(o.key)}>
                    {o.label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>{SUB_PAPER_SEND_BY.find((o) => o.key === by)?.hint}</div>
            </div>
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
                  </>
                ) : (
                  plan.text
                )}
              </div>
            </div>
            <div style={{ ...field, fontSize: '0.8125rem', padding: '0.5rem 0.7rem', border: '1px solid var(--border)', borderRadius: 6 }}>
              <b>When you press {by === 'link' ? 'Copy' : 'Send'}</b>
              <ol style={{ margin: '0.25rem 0 0 1.1rem', padding: 0 }}>
                {plan.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </div>
            {plan.blocked ? (
              <div role="alert" style={{ ...field, fontSize: '0.8125rem', color: 'var(--text-amber-900)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', borderRadius: 6, padding: '0.45rem 0.65rem' }}>
                {plan.blocked}
              </div>
            ) : null}
          </>
        ) : null}

        {said ? (
          <div role={said.tone === 'bad' ? 'alert' : 'status'} style={{ ...field, fontSize: '0.8125rem', color: said.tone === 'bad' ? 'var(--text-red-700)' : 'var(--text-green-700)' }}>
            {said.words}
          </div>
        ) : null}

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          {step === 'send' ? (
            <>
              <button type="button" style={quiet} onClick={() => setStep('paper')}>
                Back to the paper
              </button>
              <button type="button" disabled={!ok || !plan?.confirmLabel || !canSend || !!busy} style={press(ok && !!plan?.confirmLabel && canSend && !busy)} onClick={() => plan && paper && onSend?.(plan, [paper, ...attached], by, range)}>
                {busy ?? plan?.confirmLabel ?? 'Cannot send yet'}
              </button>
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
        {paper && step === 'paper' ? <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6, textAlign: 'right' }}>The file is {subPaperAttachmentName(paper)}</div> : null}
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
