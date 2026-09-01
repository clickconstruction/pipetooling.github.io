/**
 * Dashboard AR modal — "Customers" view (v2.2571, mockup Variant A): the AR
 * bucket regrouped by the customer you'd call. Each row wears the Money
 * waiting visual language (per-bill tone bar, "Nd waiting · usually ~Nd",
 * portal globe); expanding a row lists its bills — the Bills view's rows,
 * line items included — against that customer's own pace.
 */
import { Fragment, useState, type CSSProperties, type ReactNode } from 'react'
import { formatCurrency } from '../lib/format'
import { formatMoneyShortK } from '../lib/formatMoneyShortK'
import CustomerPortalGlobeButton from './customers/CustomerPortalGlobeButton'
import {
  filterArCustomerRows,
  sortArCustomerRows,
  type ArCustomerBill,
  type ArCustomerRollup,
  type ArCustomerRow,
  type ArCustomerSort,
} from '../lib/arCustomerRollup'
import type { FinancialBucket, FinancialItem } from '../lib/dashboardFinancials'
import type { OpenBillTone } from '../lib/jobs/moneyWaiting'
import type { CustomerSegment } from '../lib/jobs/billedExpectedPay'

/** Bill-tone colors — same set as the Pipeline's Money waiting bars (saturated status colors stay literal). */
const BILL_TONE: Record<OpenBillTone, { bar: string; bg: string; fg: string }> = {
  ok: { bar: '#4caf7d', bg: 'var(--bg-green-tint)', fg: 'var(--text-green-800)' },
  warn: { bar: '#d97706', bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)' },
  late: { bar: '#e05252', bg: 'var(--bg-red-tint)', fg: 'var(--text-red-600)' },
  undated: { bar: 'var(--border-strong)', bg: 'var(--bg-muted)', fg: 'var(--text-muted)' },
}

function segTag(segment: CustomerSegment | null) {
  if (!segment) return null
  const comm = segment === 'commercial'
  return (
    <span
      style={{
        fontSize: '0.65rem',
        fontWeight: 600,
        padding: '1px 6px',
        borderRadius: 9999,
        background: comm ? 'var(--bg-amber-tint)' : 'var(--bg-blue-tint)',
        color: comm ? 'var(--text-amber-800)' : 'var(--text-blue-800)',
        flexShrink: 0,
      }}
    >
      {comm ? 'Comm' : 'Res'}
    </span>
  )
}

function shortDate(ymd: string | null): string {
  if (!ymd) return 'no date'
  const [y, m, d] = ymd.split('-')
  return `billed ${Number(m)}/${Number(d)}/${String(y).slice(2)}`
}

const SORT_PILL = (on: boolean): CSSProperties => ({
  padding: '0.3rem 0.7rem',
  borderRadius: 999,
  fontSize: '0.75rem',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  border: on ? '1px solid var(--text-link)' : '1px solid var(--border-strong)',
  background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
  color: on ? 'var(--text-link)' : 'var(--text-muted)',
})

export type ArCustomersViewProps = {
  rollup: ArCustomerRollup
  /** Shared modal search box value — filters customers by name or any bill's label/address. */
  query: string
  onOpenJob: ((item: FinancialItem) => void) | null
  /** Renders the Bills view's per-item address + line-items block under a bill row (shared markup). */
  billExtras: (item: FinancialItem) => ReactNode
  /** Parked difficult-to-collect receivables — its own quiet group at the bottom, outside pace math. */
  collectionsSection: FinancialBucket | null
  isMobile: boolean
  /** PR B slot: chase pill beside the customer name (null renders nothing). */
  rowBadge?: (row: ArCustomerRow) => ReactNode
  /** PR B slot: call-card content rendered inside the expansion, after the bills. */
  expansionFooter?: (row: ArCustomerRow) => ReactNode
}

export default function DashboardArCustomersView({
  rollup,
  query,
  onOpenJob,
  billExtras,
  collectionsSection,
  isMobile,
  rowBadge,
  expansionFooter,
}: ArCustomersViewProps) {
  const [sort, setSort] = useState<ArCustomerSort>('slowest')
  const [paceFilter, setPaceFilter] = useState<'late' | 'ok' | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [onPaceOpen, setOnPaceOpen] = useState(false)
  const [collectionsOpen, setCollectionsOpen] = useState(false)
  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const searched = filterArCustomerRows(rollup.rows, query)
  const paceFiltered = paceFilter == null ? searched : searched.filter((r) => (paceFilter === 'late' ? r.pastPace : !r.pastPace))
  const sorted = sortArCustomerRows(paceFiltered, sort)
  // The quiet on-pace group only forms in the default lens (slowest, no filter,
  // no search) — any filter or search flattens the list so nothing hides.
  const grouping = rollup.hasPace && sort === 'slowest' && paceFilter == null && query.trim() === ''
  const mainRows = grouping ? sorted.filter((r) => r.pastPace) : sorted
  const onPaceRows = grouping ? sorted.filter((r) => !r.pastPace) : []

  const lensChip = (kind: 'late' | 'ok', label: string, count: number, open: number): ReactNode => {
    const on = paceFilter === kind
    const late = kind === 'late'
    return (
      <button
        type="button"
        aria-pressed={on}
        disabled={count === 0}
        onClick={() => setPaceFilter((prev) => (prev === kind ? null : kind))}
        title={`${count} customer${count === 1 ? '' : 's'} ${late ? 'past their own pace' : 'within their pace'} — click to ${on ? 'clear the filter' : 'show only these'}`}
        style={{
          padding: '0.3rem 0.7rem',
          borderRadius: 999,
          fontSize: '0.75rem',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          cursor: count === 0 ? 'default' : 'pointer',
          fontVariantNumeric: 'tabular-nums',
          border: on ? '1px solid currentColor' : '1px solid transparent',
          background: late ? 'var(--bg-red-tint)' : 'var(--bg-green-tint)',
          color: late ? 'var(--text-red-600)' : 'var(--text-green-800)',
          opacity: count === 0 ? 0.35 : paceFilter != null && !on ? 0.45 : 1,
        }}
      >
        {label} {formatMoneyShortK(open)} · {count}
      </button>
    )
  }

  const billRow = (b: ArCustomerBill, idx: number) => {
    const tone = BILL_TONE[b.tone]
    const clickable = b.item.jobId != null && onOpenJob != null
    return (
      <div key={b.item.key} style={{ padding: '0.4rem 0', borderTop: idx > 0 ? '1px solid var(--border)' : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.55rem' }}>
          <span
            title={b.waitDays != null ? `${b.waitDays} days since billing` : 'No bill date on this row'}
            style={{ fontWeight: 700, borderRadius: 9999, padding: '0 7px', fontSize: '0.68rem', flexShrink: 0, fontVariantNumeric: 'tabular-nums', background: tone.bg, color: tone.fg }}
          >
            {b.waitDays != null ? `${b.waitDays}d` : '—'}
          </span>
          {clickable ? (
            <button
              type="button"
              onClick={() => onOpenJob?.(b.item)}
              title="Open this job"
              aria-label={`Open job ${b.item.label}`}
              style={{ background: 'none', border: 'none', padding: 0, margin: 0, font: 'inherit', fontWeight: 600, color: 'var(--text-link)', textDecoration: 'underline', textUnderlineOffset: '2px', cursor: 'pointer', textAlign: 'left', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {b.item.label}
            </button>
          ) : (
            <span style={{ fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.item.label}</span>
          )}
          <span style={{ marginLeft: 'auto', color: 'var(--text-faint)', fontSize: '0.72rem', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
            {shortDate(b.item.dateYmd)}
          </span>
          <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>${formatCurrency(b.item.amount)}</span>
        </div>
        {b.item.pctComplete != null ? (
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-faint)', margin: '0.1rem 0 0 2.2rem' }}>{b.item.pctComplete}% done</div>
        ) : null}
        <div style={{ margin: '0 0 0 2.2rem' }}>{billExtras(b.item)}</div>
      </div>
    )
  }

  const customerRow = (row: ArCustomerRow, idx: number) => {
    const key = row.customerId ?? '∅'
    const isOpen = expanded.has(key)
    const seg = segTag(row.segment)
    const badge = rowBadge?.(row) ?? null
    const worst = row.oldestWaitDays != null && row.baselineDays != null
      ? BILL_TONE[row.pastPace ? (row.oldestWaitDays >= row.baselineDays * 2 ? 'late' : 'warn') : 'ok']
      : BILL_TONE.undated
    const jobs = new Set(row.bills.map((b) => b.item.jobId ?? b.item.key)).size
    return (
      <Fragment key={key}>
        <div
          role="button"
          tabIndex={0}
          aria-expanded={isOpen}
          onClick={() => toggle(key)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              toggle(key)
            }
          }}
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'auto minmax(0, 1fr) auto auto' : 'auto minmax(140px, 190px) 1fr auto auto',
            gap: '0.6rem',
            alignItems: 'center',
            padding: '0.5rem 0.45rem',
            background: idx % 2 === 1 ? 'var(--bg-muted)' : 'transparent',
            borderRadius: isOpen ? '6px 6px 0 0' : 6,
            cursor: 'pointer',
          }}
        >
          <span aria-hidden style={{ color: 'var(--text-muted)', fontSize: '0.6rem', width: '0.7em', display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'none' }}>
            ▶
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', minWidth: 0, fontSize: '0.8125rem' }}>
            <span title={row.name} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
              {row.name}
            </span>
            {seg != null || badge != null ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                {seg}
                {badge}
              </span>
            ) : null}
          </span>
          {!isMobile ? (
            <span style={{ display: 'flex', gap: 3, alignItems: 'center', height: 14, minWidth: 0 }}>
              {row.bills.map((b) => (
                <span
                  key={b.item.key}
                  title={`${b.item.label} — $${formatCurrency(b.item.amount)}${b.waitDays != null ? `, waiting ${b.waitDays}d` : ', no bill date'}`}
                  style={{
                    height: 12,
                    borderRadius: 3,
                    minWidth: 8,
                    width: `${row.open > 0 ? Math.max((b.item.amount / row.open) * 100, 3) : 3}%`,
                    background: BILL_TONE[b.tone].bar,
                    opacity: b.tone === 'undated' ? 0.7 : 0.85,
                  }}
                />
              ))}
            </span>
          ) : null}
          <span style={{ textAlign: 'right', fontSize: '0.76rem', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            <b style={{ color: worst.fg }}>{row.oldestWaitDays != null ? `${row.oldestWaitDays}d waiting` : 'undated'}</b>
            <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              {row.baselineDays == null
                ? ''
                : row.ownMedianDays != null
                  ? `usually ~${row.ownMedianDays}d · `
                  : `no history — vs company ~${row.baselineDays}d · `}
              <b style={{ color: 'var(--text-700)' }}>${formatCurrency(row.open)}</b> on {jobs} {jobs === 1 ? 'job' : 'jobs'}
            </span>
          </span>
          <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} style={{ display: 'inline-flex' }}>
            {row.customerId ? <CustomerPortalGlobeButton customerId={row.customerId} customerName={row.name} size={13} /> : null}
          </span>
        </div>
        {isOpen ? (
          <div style={{ padding: '0.1rem 0.5rem 0.55rem 2rem', background: idx % 2 === 1 ? 'var(--bg-muted)' : 'transparent', borderRadius: '0 0 6px 6px' }}>
            {row.bills.map((b, bi) => billRow(b, bi))}
            {expansionFooter?.(row)}
          </div>
        ) : null}
      </Fragment>
    )
  }

  return (
    <div style={{ padding: '0.5rem 0 0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', padding: '0 0 0.6rem' }}>
        <button type="button" aria-pressed={sort === 'slowest'} onClick={() => setSort('slowest')} style={SORT_PILL(sort === 'slowest')}>
          Slowest first
        </button>
        <button type="button" aria-pressed={sort === 'biggest'} onClick={() => setSort('biggest')} style={SORT_PILL(sort === 'biggest')}>
          Biggest
        </button>
        {rollup.hasPace ? (
          <>
            <span aria-hidden style={{ width: 1, height: '1.25rem', background: 'var(--border)', margin: '0 0.2rem' }} />
            {lensChip('late', 'Past their pace', rollup.pastPace.count, rollup.pastPace.open)}
            {lensChip('ok', 'On pace', rollup.onPace.count, rollup.onPace.open)}
          </>
        ) : (
          <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>Pay speeds unavailable — no pace lens</span>
        )}
      </div>

      {sorted.length === 0 ? (
        <p style={{ padding: '1rem 0.25rem', textAlign: 'center', color: 'var(--text-faint)', fontSize: '0.875rem' }}>
          {query.trim() !== '' ? `Nothing matches “${query.trim()}”.` : 'Nothing here.'}
        </p>
      ) : (
        <>
          {mainRows.map((row, i) => customerRow(row, i))}
          {onPaceRows.length > 0 ? (
            <>
              <div
                role="button"
                tabIndex={0}
                aria-expanded={onPaceOpen}
                onClick={() => setOnPaceOpen((v) => !v)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setOnPaceOpen((v) => !v)
                  }
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.45rem', marginTop: '0.25rem', borderTop: '1px solid var(--border)', cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-muted)' }}
              >
                <span aria-hidden style={{ fontSize: '0.6rem', width: '0.7em', transform: onPaceOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
                <span style={{ fontWeight: 600 }}>
                  {onPaceRows.length} customer{onPaceRows.length === 1 ? '' : 's'} on pace
                </span>
                <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
                  ${formatCurrency(onPaceRows.reduce((s, r) => s + r.open, 0))}
                </span>
              </div>
              {onPaceOpen ? onPaceRows.map((row, i) => customerRow(row, mainRows.length + i)) : null}
            </>
          ) : null}
          {collectionsSection && collectionsSection.count > 0 && paceFilter == null ? (
            <>
              <div
                role="button"
                tabIndex={0}
                aria-expanded={collectionsOpen}
                onClick={() => setCollectionsOpen((v) => !v)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setCollectionsOpen((v) => !v)
                  }
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.45rem', marginTop: '0.25rem', borderTop: '1px solid var(--border)', cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-muted)' }}
              >
                <span aria-hidden style={{ fontSize: '0.6rem', width: '0.7em', transform: collectionsOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
                <span style={{ fontWeight: 600 }}>Collections (difficult to collect)</span>
                <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
                  {collectionsSection.count} bill{collectionsSection.count === 1 ? '' : 's'} · ${formatCurrency(collectionsSection.total)}
                </span>
              </div>
              {collectionsOpen ? (
                <div style={{ padding: '0.1rem 0.5rem 0.55rem 2rem' }}>
                  {collectionsSection.items.map((item, i) =>
                    billRow({ item, waitDays: null, tone: 'undated' }, i),
                  )}
                </div>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </div>
  )
}
