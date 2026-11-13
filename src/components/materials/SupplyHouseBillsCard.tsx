import type { CSSProperties, ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import { billDateWords, billDayName, groupSupplyBills, isBareOfJobAccount, supplyBillSummary, type SupplyBillGroup } from '../../lib/materials/supplyBillGroups'
import { isSupplyCredit } from '../../lib/supplyHouseDocument'
import { formatCurrency } from '../../lib/format'

/**
 * A supply house's bills, as its card shows them at a desk (punch list #334 PR 5, 2026-11-12).
 *
 * The owner opens a house "to see the invoices and to potentially mark some of them as paid, if we can quickly pay
 * them then and there", and asked for the view to be refreshed. It was a table eleven columns wide. Here:
 *
 * - **A summary first**: what is open, past due, due next, and not on a job account (`supplyBillSummary`).
 * - **The bills in groups by due day**, each with its count and total, which go down as bills are paid.
 * - **A bill is two lines.** What it is for leads: the job, or the PO's words when no job is on it. The invoice
 *   number, the PO, the day it was billed, the lines check and the link to the paper sit under it.
 * - **The amount and Mark paid at the right edge**, in the same place on every row. Each bill is marked by itself
 *   (the owner: "I think we should individually mark them as paid"). A bill marked on this visit stays where it was,
 *   greyed, with *Mark unpaid*.
 * - Edit stays one press away on every row, and *Look* shows where the bill's lines were read.
 *
 * It draws only. The host holds the bills, the save and the windows the presses open.
 */

export type SupplyBillCardRow = {
  id: string
  invoice_number: string
  purchase_order_number: string | null
  invoice_date: string
  due_date: string | null
  amount: number
  is_paid: boolean
  /** The day it was paid, company time, as `YYYY-MM-DD`; null while unpaid. */
  paidYmd: string | null
  link: string | null
  payment_link: string | null
  on_job_account: boolean | null
  /** The jobs the bill is put to, as the card names them. */
  jobs: ReadonlyArray<{ label: string; pct: number }>
  /** The PO number is a PO Generator code with no ledger entry for this house. */
  poMismatch: boolean
  /** "Credits S-123", or the like, when a credit and a bill name each other. */
  pairLine: string | null
  /** The lines check: its words, its tone, and whether there is a paper to look at. */
  lines: { words: string; tone: 'ok' | 'accepted' | 'off' | 'none'; look: boolean }
}

const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const quiet: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.4 }
const link: CSSProperties = { color: 'var(--text-link)', textDecoration: 'none', whiteSpace: 'nowrap' }
const tag = (tone: 'green' | 'amber' | 'red'): CSSProperties => ({
  display: 'inline-block',
  padding: '1px 8px',
  borderRadius: 999,
  fontSize: '0.6875rem',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  background: tone === 'green' ? 'var(--bg-green-100)' : tone === 'amber' ? 'var(--bg-amber-100)' : 'var(--bg-red-100)',
  color: tone === 'green' ? 'var(--text-green-700)' : tone === 'amber' ? 'var(--text-amber-800)' : 'var(--text-red-800)',
})
const daysBetween = (fromYmd: string, toYmd: string): number => Math.round((Date.parse(`${toYmd}T00:00:00Z`) - Date.parse(`${fromYmd}T00:00:00Z`)) / 86_400_000)

export function SupplyHouseBillsCard({
  bills,
  todayYmd,
  jobAccountsInUse,
  paidThisVisit,
  payingId,
  empty,
  onTogglePaid,
  onEdit,
  onLook,
}: {
  /** The bills to list: the unpaid ones, the ones paid on this visit, and every paid one when the page shows them. */
  bills: ReadonlyArray<SupplyBillCardRow>
  todayYmd: string
  /** This house puts charges on job accounts, so a bill that is not on one is worth saying. */
  jobAccountsInUse: boolean
  paidThisVisit: ReadonlySet<string>
  /** The bill whose Mark paid is saving; every press waits while one saves. */
  payingId: string | null
  /** What to say when there is no bill to list. */
  empty: ReactNode
  onTogglePaid: (id: string) => void
  onEdit: (id: string) => void
  onLook: (id: string) => void
}) {
  const dayName = (ymd: string): string => billDayName(ymd, todayYmd)
  const stats = supplyBillSummary(
    bills.map((b) => ({ id: b.id, due_date: b.due_date, amount: b.amount, is_paid: b.is_paid, on_job_account: b.on_job_account, hasJob: b.jobs.length > 0 })),
    todayYmd,
    dayName,
    { jobAccountsInUse },
  )
  // Largest first inside a group. Past due is read oldest first by the grouping, the largest of a day leading.
  const ordered = [...bills].sort((a, b) => b.amount - a.amount)
  const groups: SupplyBillGroup<SupplyBillCardRow>[] = groupSupplyBills(ordered, todayYmd, dayName, paidThisVisit)

  const row = (b: SupplyBillCardRow, kind: SupplyBillGroup<SupplyBillCardRow>['kind']) => {
    const paidNow = b.is_paid && paidThisVisit.has(b.id)
    const credit = isSupplyCredit(b.amount)
    const po = b.purchase_order_number?.trim() ?? ''
    const bare = jobAccountsInUse && isBareOfJobAccount({ id: b.id, due_date: b.due_date, amount: b.amount, is_paid: b.is_paid, on_job_account: b.on_job_account, hasJob: b.jobs.length > 0 })
    const lateDays = !b.is_paid && b.due_date && b.due_date < todayYmd ? daysBetween(b.due_date, todayYmd) : 0
    const title = b.jobs.length > 0 ? b.jobs.map((j) => (b.jobs.length > 1 ? `${j.label} (${j.pct}%)` : j.label)).join(', ') : po || 'No job on this bill'
    const facts: ReactNode[] = []
    if (paidNow) facts.push(<b key="paidnow">Paid today</b>)
    else if (b.is_paid && b.paidYmd) facts.push(<span key="paid">paid {billDateWords(b.paidYmd, todayYmd)}</span>)
    facts.push(<span key="inv">{b.invoice_number}</span>)
    // The PO's words lead the row when there is no job; they are not said twice.
    if (po && b.jobs.length > 0) {
      facts.push(
        <span key="po" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          PO {po}
          {b.poMismatch && (
            <span title="No PO Generator ledger entry for this number for this supply house.">
              <AlertCircle size={14} color="#dc2626" aria-label="No PO Generator ledger entry for this number for this supply house." style={{ display: 'block' }} />
            </span>
          )}
        </span>,
      )
    }
    facts.push(<span key="billed">billed {billDateWords(b.invoice_date, todayYmd)}</span>)
    // The group names the due day; past due is many days in one group, so each row says its own.
    if (kind === 'past' && b.due_date) facts.push(<span key="due">due {billDateWords(b.due_date, todayYmd)}</span>)
    return (
      <div key={b.id} data-testid="supply-bill-row" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 14px', padding: '0.55rem 0.75rem', borderTop: '1px solid var(--border)', opacity: paidNow ? 0.55 : 1 }}>
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: b.jobs.length > 0 || po ? 'var(--text-strong)' : 'var(--text-muted)', overflowWrap: 'anywhere' }} data-testid="supply-bill-title">
            {title}{' '}
            {b.on_job_account === true && (
              <span style={tag('green')} title="On the house's job account. If this goes unpaid, the house bills the property owner, not you.">
                Job acct
              </span>
            )}
            {bare && (
              <span style={tag('amber')} title="This charge is for a job and is not on the house's job account, so it is ours alone if it goes unpaid.">
                no job account
              </span>
            )}{' '}
            {lateDays > 0 && <span style={tag(lateDays >= 60 ? 'red' : 'amber')}>{lateDays}d past due</span>}
          </div>
          <div style={{ ...quiet, display: 'flex', flexWrap: 'wrap', gap: '2px 10px', alignItems: 'center', fontVariantNumeric: 'tabular-nums' }}>
            {facts.map((f, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                {i > 0 && <span aria-hidden>·</span>}
                {f}
              </span>
            ))}
            <span aria-hidden>·</span>
            {/* A gap's words run long ("Line 7: the quantity times the price is …"), so this tag may wrap. */}
            <span style={b.lines.tone === 'ok' || b.lines.tone === 'accepted' ? tag('green') : b.lines.tone === 'off' ? { ...tag('amber'), whiteSpace: 'normal', borderRadius: 10 } : undefined} data-testid="supply-lines-cell">
              {b.lines.words}
            </span>
            {b.lines.look && (
              <button type="button" onClick={() => onLook(b.id)} title="See where each line was read on the bill" style={{ font: 'inherit', fontSize: '0.78rem', padding: 0, border: 'none', background: 'transparent', color: 'var(--text-link)', cursor: 'pointer' }}>
                Look ›
              </button>
            )}
            {b.link && (
              <a href={b.link} target="_blank" rel="noreferrer" title="The invoice" style={link}>
                See the bill ›
              </a>
            )}
            {b.payment_link && (
              <a href={b.payment_link} target="_blank" rel="noreferrer" title="Payment or receipt (Make Payment)" style={link}>
                Receipt ›
              </a>
            )}
          </div>
          {b.pairLine && (
            <div style={{ ...quiet, fontSize: '0.72rem' }} data-testid="supply-credit-pair">
              {b.pairLine}
            </div>
          )}
        </div>
        {/* The amount and the two presses stay together, so a narrow card wraps them as one and Edit never drops alone. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: '0 0 auto', marginLeft: 'auto' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', textAlign: 'right', minWidth: 96, color: credit ? 'var(--text-green-700)' : 'var(--text-strong)' }} data-testid="supply-bill-amount">
            {credit ? `− $${formatCurrency(Math.abs(b.amount))}` : `$${formatCurrency(b.amount)}`}
            {credit && <span style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 500 }}>credit</span>}
          </div>
          {/* Each bill is marked by itself, and the press names the act. */}
          <button
            type="button"
            disabled={payingId != null}
            onClick={() => onTogglePaid(b.id)}
            aria-label={`${b.is_paid ? 'Mark unpaid' : 'Mark paid'}: ${b.invoice_number}`}
            data-testid="supply-bill-mark-paid"
            style={{ minHeight: 36, minWidth: 104, padding: '0.3rem 0.8rem', font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap', background: 'var(--surface)', color: b.is_paid ? 'var(--text-muted)' : 'var(--text-green-700)', border: `1px solid ${b.is_paid ? 'var(--border-strong)' : 'var(--text-green-700)'}`, borderRadius: 6, cursor: payingId != null ? 'default' : 'pointer' }}
          >
            {payingId === b.id ? 'Saving…' : b.is_paid ? 'Mark unpaid' : 'Mark paid'}
          </button>
          <button type="button" onClick={() => onEdit(b.id)} title="Edit" aria-label={`Edit ${b.invoice_number}`} style={{ minHeight: 36, minWidth: 36, padding: '0.25rem', cursor: 'pointer', background: 'none', border: 'none', color: 'var(--text-muted)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width={16} height={16} fill="currentColor" aria-hidden="true">
              <path d="M362.7 19.3L314.3 67.7 444.3 197.7 492.7 149.3c25-25 25-65.5 0-90.5L453.3 19.3c-25-25-65.5-25-90.5 0zm-71 71L58.6 323.5c-10.4 10.4-18.3 23.3-22.2 37.4L1 481.2C-1.5 489.7 .8 498.8 7 505s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L421.7 220.3 291.7 90.3z" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="supply-bills-card">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: '0.75rem' }} data-testid="supply-bills-summary">
        {stats.map((s) => (
          <div key={s.key} data-testid={`supply-bills-stat-${s.key}`} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.55rem 0.75rem', minWidth: 0 }}>
            <div style={label}>{s.label}</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums', color: s.tone === 'red' ? 'var(--text-red-700)' : s.tone === 'amber' ? 'var(--text-amber-800)' : 'var(--text-strong)' }}>{s.value}</div>
            <div style={quiet}>{s.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)' }}>
        {groups.length === 0
          ? empty
          : groups.map((g) => (
              <div key={g.key}>
                <div data-due-group={g.key} data-testid="supply-bill-group" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '0.45rem 0.75rem', background: 'var(--bg-muted)', borderTop: '1px solid var(--border)', scrollMarginTop: 'calc(var(--app-top-chrome, 0px) + 1rem)' }}>
                  <b style={{ color: g.kind === 'past' ? 'var(--text-red-700)' : 'var(--text-strong)' }}>{g.title}</b>
                  <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{g.kind === 'paid' || g.count === 0 ? g.words : `${g.words} left`}</span>
                </div>
                {g.rows.map((b) => row(b, g.kind))}
              </div>
            ))}
      </div>
    </div>
  )
}
