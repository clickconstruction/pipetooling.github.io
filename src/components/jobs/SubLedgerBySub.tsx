/**
 * The Subs Ledger's other grouping (punch list #347, PR 3): one row per person, and one person's statement.
 *
 * The list answers "what did we pay each sub in this period, and what do we still owe them". A name opens that
 * person's statement: their sheets and their money oldest first, with what we owed after each line. A statement of
 * every date ends on what their sheets owe today, and its foot holds that against People → Subs when the roster's
 * figure is known. Nothing here is fetched or written: both views read the sheets the ledger already holds.
 */
import type { LedgerBySubTotals, LedgerSubRow, StatementEntry, SubStatement } from '../../lib/subWorkOrders/subPaymentsLedger'
import { ledgerDayWords, ledgerHowPaidWords, ledgerSpanWords, overPaidWords, weOweWords } from '../../lib/subWorkOrders/subPaymentsLedger'
import { AmountSmallCents } from '../AmountSmallCents'
import { jobLink, pill, td, th } from './subLedgerStyles'

/** What we owe, as a cell: an amount, `settled`, or `over by …` in green. */
function Owed({ value }: { value: number }) {
  if (value === 0) return <span style={pill('green')}>settled</span>
  if (value < 0) return <span style={{ color: 'var(--text-green-700)' }}>{weOweWords(value)}</span>
  return (
    <span style={{ fontWeight: 700, color: 'var(--text-strong)' }}>
      <AmountSmallCents value={value} />
    </span>
  )
}

const right = { ...td, textAlign: 'right', whiteSpace: 'nowrap' } as const
const footCell = { ...td, borderBottom: 'none', background: 'var(--bg-subtle)', fontWeight: 700, color: 'var(--text-strong)' } as const

export function SubLedgerPeople({ rows, totals, periodLabel, narrow, withYear, onOpen }: { rows: readonly LedgerSubRow[]; totals: LedgerBySubTotals; periodLabel: string; narrow: boolean; withYear: boolean; onOpen: (key: string) => void }) {
  const paymentsWords = (r: LedgerSubRow) => (r.payments === 0 ? 'nothing paid' : r.payments === 1 ? '1 payment' : `${r.payments} payments`)
  if (narrow) {
    return (
      <div data-ledger-people-phone style={{ display: 'grid', gap: 6 }}>
        {rows.map((r) => (
          <button key={r.key} type="button" data-ledger-sub={r.key} onClick={() => onOpen(r.key)} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 10px', padding: '0.55rem 0.7rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer', width: '100%' }}>
            <span style={{ minWidth: 0, fontWeight: 600 }}>
              {r.name}
              {r.crew ? <span style={{ ...pill('gray'), marginLeft: 6 }}>crew</span> : null}
            </span>
            <span style={{ whiteSpace: 'nowrap', fontWeight: 700, color: 'var(--text-strong)' }}>
              <AmountSmallCents value={r.paid} />
            </span>
            <span style={{ gridColumn: '1 / -1', fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: 0 }}>
              {[paymentsWords(r), ledgerSpanWords(r.firstYmd, r.lastYmd, withYear), r.backcharges ? `back-charged $${r.backcharged.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '', r.weOwe === null ? 'paid through payroll' : r.weOwe === 0 ? (r.over ? '' : 'settled') : `we owe ${weOweWords(r.weOwe)}`, overPaidWords(r.over)].filter(Boolean).join(' · ')}
            </span>
          </button>
        ))}
      </div>
    )
  }
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflowX: 'auto', background: 'var(--surface)' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 760 }}>
        <thead>
          <tr>
            <th style={th}>Sub</th>
            <th style={th}>Payments</th>
            <th style={th}>First to last</th>
            <th style={{ ...th, textAlign: 'right' }}>Paid in this period</th>
            <th style={{ ...th, textAlign: 'right' }}>Back-charged</th>
            <th style={{ ...th, textAlign: 'right' }}>We owe today</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} data-ledger-sub={r.key}>
              <td style={td}>
                <button type="button" onClick={() => onOpen(r.key)} title="Open their statement" style={{ ...jobLink, fontWeight: 600 }}>
                  {r.name}
                </button>
                {r.crew ? <span style={{ ...pill('gray'), marginLeft: 6 }}>crew</span> : null}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.sheets === 1 ? '1 sheet' : `${r.sheets} sheets`}</div>
              </td>
              <td style={{ ...td, color: r.payments ? undefined : 'var(--text-muted)' }}>{paymentsWords(r)}</td>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>{ledgerSpanWords(r.firstYmd, r.lastYmd, withYear) || <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
              <td style={{ ...right, fontWeight: 700, color: 'var(--text-strong)' }}>
                <AmountSmallCents value={r.paid} />
              </td>
              <td style={{ ...right, color: r.backcharges ? 'var(--text-red-700)' : 'var(--text-faint)' }}>{r.backcharges ? <AmountSmallCents value={r.backcharged} /> : '—'}</td>
              <td style={right}>
                {r.weOwe === null ? (
                  <span title="A crew sheet pays through payroll, so it is in nobody's balance." style={{ color: 'var(--text-muted)' }}>
                    payroll
                  </span>
                ) : r.weOwe === 0 && r.over ? null : (
                  <Owed value={r.weOwe} />
                )}
                {r.over ? (
                  <div data-ledger-over={r.key} title="A sheet of theirs was paid past its total. It is not taken off what another sheet is owed." style={{ fontSize: '0.75rem', color: 'var(--text-green-700)' }}>
                    {overPaidWords(r.over)}
                  </div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr data-ledger-people-foot>
            <td colSpan={3} style={footCell}>
              {periodLabel} · {totals.people === 1 ? '1 person' : `${totals.people} people`} · {totals.payments === 1 ? '1 payment' : `${totals.payments} payments`}
            </td>
            <td style={{ ...footCell, textAlign: 'right', whiteSpace: 'nowrap' }}>
              <AmountSmallCents value={totals.paid} />
            </td>
            <td style={{ ...footCell, textAlign: 'right', whiteSpace: 'nowrap' }}>{totals.backcharged ? <AmountSmallCents value={totals.backcharged} /> : ''}</td>
            <td style={{ ...footCell, textAlign: 'right', whiteSpace: 'nowrap' }}>
              <AmountSmallCents value={totals.weOwe} />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

const WHAT: Record<StatementEntry['kind'], string> = { sheet: 'Sheet agreed', payment: 'Payment', backcharge: 'Back-charge' }

export function SubLedgerStatement({ statement: st, check, narrow, withYear, onOpenSheet }: { statement: SubStatement; check: { agrees: boolean | null; words: string }; narrow: boolean; withYear: boolean; onOpenSheet: (sheetId: string) => void }) {
  const day = (e: StatementEntry) => (
    <>
      <span style={{ fontWeight: e.recorded ? 400 : 700, color: e.recorded ? 'var(--text-muted)' : 'var(--text-strong)' }}>{ledgerDayWords(e.ymd, withYear)}</span>
      {e.recorded ? <span style={{ marginLeft: 6, fontSize: '0.72rem', color: 'var(--text-muted)' }}>recorded</span> : null}
    </>
  )
  const what = (e: StatementEntry) => (
    <>
      <span style={e.kind === 'backcharge' ? pill('red') : e.kind === 'sheet' ? pill('gray') : { fontWeight: 600 }}>{WHAT[e.kind]}</span>
      {[ledgerHowPaidWords(e), e.memo].filter(Boolean).map((w) => (
        <span key={w} style={{ color: 'var(--text-muted)' }}>
          {' '}
          · {w}
        </span>
      ))}
    </>
  )
  const checkLine = (
    <p data-statement-check={check.agrees === null ? 'unknown' : check.agrees ? 'agrees' : 'differs'} style={{ margin: '8px 2px 0', fontSize: '0.8125rem', color: check.agrees === false ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>
      {check.agrees === true ? <span style={{ ...pill('green'), marginRight: 6 }}>✓ checks</span> : check.agrees === false ? <span style={{ ...pill('amber'), marginRight: 6 }}>differs</span> : null}
      {check.words}
    </p>
  )
  const endWords = st.endsToday ? 'We owe today' : 'We owed at the end'
  if (narrow) {
    return (
      <div data-ledger-statement={st.key}>
        <div style={{ display: 'grid', gap: 6 }}>
          {st.from ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0.3rem 0.6rem', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 8 }}>
              Brought forward · {weOweWords(st.opening)}
            </div>
          ) : null}
          {st.entries.map((e) => (
            <button key={e.id} type="button" data-statement-line={e.id} onClick={() => onOpenSheet(e.sheetId)} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 10px', padding: '0.55rem 0.7rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer', width: '100%' }}>
              <span style={{ minWidth: 0 }}>
                {day(e)} · {what(e)}
              </span>
              <span style={{ whiteSpace: 'nowrap', fontWeight: 700, color: e.kind === 'sheet' ? 'var(--text-strong)' : e.kind === 'backcharge' ? 'var(--text-red-700)' : 'var(--text-strong)' }}>
                {e.kind === 'sheet' ? '+' : '−'}
                <AmountSmallCents value={e.amount} />
              </span>
              <span style={{ gridColumn: '1 / -1', fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: 0 }}>
                {e.job} · we owe {weOweWords(e.owed)}
              </span>
            </button>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '0.5rem 0.7rem', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 8, fontWeight: 700, color: 'var(--text-strong)' }}>
            <span>{endWords}</span>
            <span>{weOweWords(st.closing)}</span>
          </div>
        </div>
        {checkLine}
      </div>
    )
  }
  return (
    <div data-ledger-statement={st.key}>
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflowX: 'auto', background: 'var(--surface)' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 820 }}>
          <thead>
            <tr>
              <th style={th}>Date</th>
              <th style={th}>What</th>
              <th style={th}>Job</th>
              <th style={{ ...th, textAlign: 'right' }}>Agreed</th>
              <th style={{ ...th, textAlign: 'right' }}>Paid</th>
              <th style={{ ...th, textAlign: 'right' }}>We owe</th>
            </tr>
          </thead>
          <tbody>
            {st.from ? (
              <tr data-statement-forward>
                <td style={{ ...td, background: 'var(--bg-subtle)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{ledgerDayWords(st.from, withYear)}</td>
                <td colSpan={4} style={{ ...td, background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
                  Brought forward
                </td>
                <td style={{ ...right, background: 'var(--bg-subtle)' }}>
                  <Owed value={st.opening} />
                </td>
              </tr>
            ) : null}
            {st.entries.map((e) => (
              <tr key={e.id} data-statement-line={e.id}>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{day(e)}</td>
                <td style={td}>{what(e)}</td>
                <td style={td}>
                  <button type="button" onClick={() => onOpenSheet(e.sheetId)} title="Open the sheet" style={jobLink}>
                    {e.job}
                  </button>
                  {e.address && !e.job.includes(e.address) ? <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{e.address}</div> : null}
                </td>
                <td style={right}>{e.kind === 'sheet' ? <AmountSmallCents value={e.amount} /> : ''}</td>
                <td style={{ ...right, color: e.kind === 'backcharge' ? 'var(--text-red-700)' : undefined }}>{e.kind === 'sheet' ? '' : <AmountSmallCents value={e.amount} />}</td>
                <td style={right}>
                  <Owed value={e.owed} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr data-statement-foot>
              <td colSpan={3} style={footCell}>
                {endWords}
              </td>
              <td style={{ ...footCell, textAlign: 'right', whiteSpace: 'nowrap' }}>
                <AmountSmallCents value={st.agreed} />
              </td>
              <td style={{ ...footCell, textAlign: 'right', whiteSpace: 'nowrap' }}>
                <AmountSmallCents value={Math.round((st.paid + st.backcharged) * 100) / 100} />
              </td>
              <td style={{ ...footCell, textAlign: 'right', whiteSpace: 'nowrap' }}>{weOweWords(st.closing)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {checkLine}
    </div>
  )
}
