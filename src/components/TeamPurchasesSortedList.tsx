import { useMemo, useState, type CSSProperties } from 'react'
import { useLedgerPrefixMap } from '../contexts/LedgerDisplayPrefixContext'
import { APP_CALENDAR_TZ } from '../utils/dateUtils'
import {
  invoiceTotalForCharge,
  parseSortedInvoiceLinks,
  parseSortedJobSplits,
  sortedRowIsShort,
  sortedWentToLines,
  sortedWhenWords,
  type SortedTeamPurchaseRow,
} from '../lib/teamPurchasesSorted'

/**
 * Team purchases follow-up → Sorted (v2.4566): the card charges already sorted, newest sort
 * first, each saying where it went and offering the way back in — the invoices window for a
 * charge matched to invoices, the Assign window for one split to jobs.
 */
export type TeamPurchasesSortedListProps = {
  rows: SortedTeamPurchaseRow[]
  isNarrow: boolean
  windowDays: number
  onChangeJobs: (row: SortedTeamPurchaseRow) => void
  onInvoices: (row: SortedTeamPurchaseRow) => void
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function formatPosted(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const day = d.toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: APP_CALENDAR_TZ })
  const time = d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: APP_CALENDAR_TZ })
  return `${day} · ${time}`
}

const rowButton: CSSProperties = {
  padding: '0.35rem 0.65rem',
  borderRadius: 6,
  border: '1px solid #2563eb',
  background: 'var(--surface)',
  color: 'var(--text-blue-700)',
  fontWeight: 600,
  fontSize: '0.8125rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
}

export function TeamPurchasesSortedList({ rows, isNarrow, windowDays, onChangeJobs, onInvoices }: TeamPurchasesSortedListProps) {
  const prefixMap = useLedgerPrefixMap()
  const [shortOnly, setShortOnly] = useState(false)
  const shortCount = useMemo(() => rows.filter(sortedRowIsShort).length, [rows])
  const visible = shortOnly && shortCount > 0 ? rows.filter(sortedRowIsShort) : rows
  const nowMs = Date.now()

  if (rows.length === 0) {
    return (
      <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 8 }}>
        Nothing was sorted in the last {windowDays} days.
      </div>
    )
  }

  return (
    <div data-testid="team-purchases-sorted">
      {shortCount > 0 ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '0.35rem 0.75rem',
            padding: '0.5rem 0.7rem',
            marginBottom: '0.75rem',
            borderRadius: 6,
            background: 'var(--bg-amber-tint)',
            color: 'var(--text-amber-700)',
            fontSize: '0.8125rem',
          }}
        >
          <span>
            {shortCount === 1
              ? '1 charge is matched to invoices that add up to less than the charge.'
              : `${shortCount} charges are matched to invoices that add up to less than the charge.`}
          </span>
          <button
            type="button"
            aria-pressed={shortOnly}
            onClick={() => setShortOnly((v) => !v)}
            style={{ border: 'none', background: 'none', padding: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer', font: 'inherit', fontWeight: 600 }}
          >
            {shortOnly ? 'Show all' : shortCount === 1 ? 'Show only that one' : 'Show only those'}
          </button>
        </div>
      ) : null}
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        {visible.map((r, i) => {
          const invoices = parseSortedInvoiceLinks(r.invoice_links)
          const jobs = parseSortedJobSplits(r.job_splits)
          const total = invoiceTotalForCharge(Number(r.amount), invoices.map((x) => x.amount))
          const wentTo = sortedWentToLines(r, prefixMap)
          const buttons = (
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: isNarrow ? 'stretch' : 'flex-end' }}>
              {invoices.length > 0 ? (
                <button type="button" onClick={() => onInvoices(r)} style={{ ...rowButton, flex: isNarrow ? 1 : undefined, padding: isNarrow ? '0.55rem 0' : rowButton.padding }}>
                  {total.tone === 'short' ? 'Add invoice' : 'Invoices'}
                </button>
              ) : null}
              {jobs.length > 0 || invoices.length === 0 ? (
                <button type="button" onClick={() => onChangeJobs(r)} style={{ ...rowButton, flex: isNarrow ? 1 : undefined, padding: isNarrow ? '0.55rem 0' : rowButton.padding }}>
                  Change
                </button>
              ) : null}
            </div>
          )
          const detail = (
            <>
              {wentTo.map((line) => (
                <div key={line} style={{ color: 'var(--text-slate-600)', wordBreak: 'break-word' }}>{line}</div>
              ))}
              {total.tone === 'short' || total.tone === 'over' ? (
                <div style={{ color: 'var(--text-amber-700)', fontWeight: 600 }}>{total.words}</div>
              ) : null}
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                {r.target_name?.trim() ? `${r.target_name.trim()}'s card · ` : ''}
                {sortedWhenWords(r.sorted_at, r.sorted_by_name, nowMs)}
              </div>
            </>
          )
          return (
            <div
              key={r.mercury_transaction_id}
              data-testid="team-purchases-sorted-row"
              style={{
                borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                padding: isNarrow ? '0.6rem 0.7rem' : '0.5rem 0.65rem',
                fontSize: '0.8125rem',
                display: isNarrow ? 'block' : 'grid',
                gridTemplateColumns: isNarrow ? undefined : '8.5rem 5.5rem minmax(0, 1fr) auto',
                gap: '0.75rem',
                alignItems: 'center',
              }}
            >
              {isNarrow ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', fontWeight: 600, fontSize: '0.9375rem' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.counterparty_name ?? '—'}</span>
                    <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(Number(r.amount))}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.1rem 0 0.25rem' }}>{formatPosted(r.posted_at)}</div>
                  {detail}
                  <div style={{ marginTop: '0.5rem' }}>{buttons}</div>
                </>
              ) : (
                <>
                  <div style={{ whiteSpace: 'nowrap' }}>{formatPosted(r.posted_at)}</div>
                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(Number(r.amount))}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.counterparty_name ?? ''}>
                      {r.counterparty_name ?? '—'}
                    </div>
                    {detail}
                  </div>
                  {buttons}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
