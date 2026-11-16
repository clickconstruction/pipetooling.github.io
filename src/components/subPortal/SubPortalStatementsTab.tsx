/**
 * The sub's Statements tab (punch list #350, PR 6 and PR 7): their own papers, drawn from the kernel the office
 * draws them from (`_shared/subPapers.ts`), so the page and the PDF cannot disagree.
 *
 *  - The statement of account to date, live, with a period and Save as PDF.
 *  - Every work statement, paid ones too, with its PDF. **Confirm** sits behind `SUB_PAPER_CONFIRM_LIVE`, which is
 *    off: what a confirm means is counsel's sentence, and until it is written the press is not drawn.
 *  - Every payment record with its PDF and **Got it**.
 *
 * NOT WIRED into `SubPortal.tsx` or the `sub-portal` function in the spike. It sits on card #346's PR 6 (who sees a
 * sheet's dollars on the portal), which waits on Taunya's look at its before and after. The tab is walked on made-up
 * data. A memo the office hid is already blank in the sheets it is handed, and the amounts always show.
 */
import { useMemo, useState, type CSSProperties } from 'react'
import { buildPaymentRecord, buildStatementOfAccount, buildWorkStatement, paperDay, paperMoney, paperSendings, subPapersAddUp, type PaperContext, type PaperSheet, type StatementRange } from '../../../supabase/functions/_shared/subPapers'
import type { SubPaper } from '../../lib/subWorkOrders/subPaperSend'

/** PR 7's switch. Off until counsel has written what a confirm means (sentence 2) and the owner has said yes (call 3). */
export const SUB_PAPER_CONFIRM_LIVE = false

export type SubPortalStatementsTabProps = {
  sheets: readonly PaperSheet[]
  ctx: PaperContext
  /** Payment records the sub has marked received, by sending key, with when. */
  received?: ReadonlyMap<string, string>
  narrow?: boolean
  confirmLive?: boolean
  onPdf: (paper: SubPaper, range: StatementRange) => void
  onGotIt: (sendingKey: string) => void
  onConfirm: (sheetId: string, amount: number, revision: number) => void
  onSomethingWrong: (sheetId: string) => void
}

const num: CSSProperties = { fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem', fontWeight: 700, background: 'var(--bg-neutral-100)', color: 'var(--text-700)', borderRadius: 5, padding: '0.05rem 0.35rem', whiteSpace: 'nowrap' }
const quiet: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, padding: '0.35rem 0.75rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer', whiteSpace: 'nowrap' }
const press: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', fontWeight: 650, padding: '0.35rem 0.8rem', borderRadius: 6, border: 'none', background: '#2563eb', color: 'white', cursor: 'pointer', whiteSpace: 'nowrap' }
const chip = (bg: string, fg: string): CSSProperties => ({ fontSize: '0.7rem', fontWeight: 650, borderRadius: 999, padding: '0.08rem 0.5rem', whiteSpace: 'nowrap', background: bg, color: fg })
const row: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem 0.6rem', padding: '0.6rem 0', borderTop: '1px solid var(--border)' }

export function SubPortalStatementsTab({ sheets, ctx, received, narrow = false, confirmLive = SUB_PAPER_CONFIRM_LIVE, onPdf, onGotIt, onConfirm, onSomethingWrong }: SubPortalStatementsTabProps) {
  const [picking, setPicking] = useState(false)
  const [dates, setDates] = useState<{ from: string; to: string }>({ from: '', to: ctx.today })
  const range = useMemo<StatementRange>(() => (picking ? { from: dates.from || null, to: dates.to || null } : { from: null, to: null }), [picking, dates])
  const built = useMemo(() => {
    const work = sheets.map((s) => buildWorkStatement(s, ctx))
    const sendings = paperSendings(sheets)
    const payments = sendings.map((s) => buildPaymentRecord(s, sheets, ctx, received?.has(s.key) ? { at: received.get(s.key)! } : null))
    const toDate = buildStatementOfAccount(sheets, { from: null, to: null }, ctx)
    return { work, payments, sendings, toDate, check: subPapersAddUp({ statement: toDate, work, payments }) }
  }, [sheets, ctx, received])
  const statement = useMemo(() => buildStatementOfAccount(sheets, range, ctx), [sheets, range, ctx])
  const last = built.sendings[built.sendings.length - 1]

  if (!built.check.ok) {
    // The sub never sees a paper that does not add up, nor the reason: the office does, on its own window.
    return <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Your statements are being checked by the office. Call the office if you need a figure today.</p>
  }

  // Open first, then the newest paid.
  const work = [...built.work].sort((a, b) => Number(b.stillOpen > 0) - Number(a.stillOpen > 0) || b.sheetId.localeCompare(a.sheetId))
  return (
    <div data-testid="sub-portal-statements">
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.7rem 0.85rem', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <b>Statement of account</b>
          <b style={{ fontSize: '1.15rem', fontVariantNumeric: 'tabular-nums' }}>{paperMoney(statement.stillOpen)}</b>
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {picking ? statement.period : 'To date, live'} · still open{last ? ` · last payment ${paperMoney(last.amount)} on ${paperDay(last.ymd) || 'a day not recorded'}` : ''}
        </div>
        {picking ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6, fontSize: '0.8125rem' }}>
            <label>
              From <input type="date" value={dates.from} max={dates.to || ctx.today} onChange={(e) => setDates({ ...dates, from: e.target.value })} style={{ fontFamily: 'inherit' }} />
            </label>
            <label>
              To <input type="date" value={dates.to} max={ctx.today} onChange={(e) => setDates({ ...dates, to: e.target.value })} style={{ fontFamily: 'inherit' }} />
            </label>
          </div>
        ) : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          <button type="button" style={press} onClick={() => onPdf(statement, range)}>
            Save as PDF
          </button>
          <button type="button" style={quiet} onClick={() => setPicking((v) => !v)}>
            {picking ? 'To date' : 'Pick dates'}
          </button>
        </div>
      </div>

      <div style={{ fontWeight: 700, margin: '1rem 0 0.2rem' }}>Work statements</div>
      {work.length === 0 ? <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>No work statements yet. One appears here for each piece of work the office writes up for you.</p> : null}
      {work.map((w) => (
        <div key={w.sheetId} style={row}>
          {w.number ? <span style={num}>{w.number}</span> : null}
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <b>{w.job.label}</b>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Comes to {paperMoney(w.comesTo)} · {w.paidSoFar > 0 ? `paid ${paperMoney(w.paidSoFar)}` : 'nothing paid'}
              {w.stillOpen > 0 ? (
                <>
                  {' '}
                  · <b style={{ color: 'var(--text-strong)' }}>{paperMoney(w.stillOpen)} open</b>
                </>
              ) : null}
            </div>
          </div>
          <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginLeft: narrow ? 0 : 'auto' }}>
            {w.stillOpen <= 0 ? <span style={chip('var(--bg-neutral-100)', 'var(--text-muted)')}>Paid</span> : null}
            {confirmLive && w.confirm && !w.confirm.current ? <span style={chip('var(--bg-amber-tint)', 'var(--text-amber-800)')}>Changed since you confirmed</span> : null}
            {confirmLive && w.confirm?.current ? <span style={chip('var(--bg-green-tint)', 'var(--text-green-600)')}>You confirmed this</span> : null}
            {confirmLive && w.stillOpen > 0 && !w.confirm?.current ? (
              <>
                <button type="button" style={press} onClick={() => onConfirm(w.sheetId, w.comesTo, w.revision)}>
                  Confirm {paperMoney(w.comesTo)}
                </button>
                <button type="button" style={quiet} onClick={() => onSomethingWrong(w.sheetId)}>
                  Something is wrong
                </button>
              </>
            ) : null}
            <button type="button" style={quiet} onClick={() => onPdf(w, { from: null, to: null })}>
              PDF
            </button>
          </span>
        </div>
      ))}

      <div style={{ fontWeight: 700, margin: '1rem 0 0.2rem' }}>Payments</div>
      {built.payments.length === 0 ? <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>No payments yet. Each one appears here the day the office records it.</p> : null}
      {built.payments
        .slice()
        .reverse()
        .map((p) => {
          const got = received?.has(p.key)
          return (
            <div key={p.key} style={row}>
              {p.number ? <span style={num}>{p.number}</span> : null}
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <b>
                  {p.sentOn} · {p.how}
                </b>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{p.applied.map((a) => `${paperMoney(a.thisPayment)} on ${a.sheetName}`).join(' · ')}</div>
              </div>
              <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginLeft: narrow ? 0 : 'auto' }}>
                <b style={{ fontVariantNumeric: 'tabular-nums' }}>{paperMoney(p.amountSent)}</b>
                {got ? (
                  <span style={chip('var(--bg-green-tint)', 'var(--text-green-600)')}>Received</span>
                ) : (
                  <button type="button" style={quiet} onClick={() => onGotIt(p.key)}>
                    Got it
                  </button>
                )}
                <button type="button" style={quiet} onClick={() => onPdf(p, { from: null, to: null })}>
                  PDF
                </button>
              </span>
            </div>
          )
        })}
    </div>
  )
}

export default SubPortalStatementsTab
