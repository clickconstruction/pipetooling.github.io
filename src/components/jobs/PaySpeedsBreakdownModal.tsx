import { useMemo, useState, type ReactNode } from 'react'
import type { StageRow } from '../../lib/jobsStagesBoard'
import type { CustomerSegment, PayReceipt, PaySpeedData, PaySpeedStat } from '../../lib/jobs/billedExpectedPay'
import { PAY_SPEED_MIN_SAMPLES, formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import {
  buildPaySpeedsBreakdown,
  formatYmdSlash,
  receiptGapTone,
  type PaySpeedCustomerRow,
} from '../../lib/jobs/paySpeedsBreakdown'
import { buildMoneyWaiting, openBillsForCustomers, billWaitTone, type MoneyWaitingRow, type OpenBill, type OpenBillTone } from '../../lib/jobs/moneyWaiting'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import PaySpeedDataHealthModal from './PaySpeedDataHealthModal'
import { useIsMobile } from '../../hooks/useIsMobile'

/**
 * The pay-speeds drill-down (owner-approved mockup, v2.2022): opened from
 * the Payment forecast's pay-speeds strip. Three tiles echo the strip, the
 * Money-waiting rows show every off-pace customer's open bills — one bar
 * segment per job, sized by dollars, expandable to the per-job list
 * (v2.2382; replaced the drift dumbbells, whose 60-day axis clipped the
 * worst rows) — and one customer list puts the slowest payers with their
 * open dollars on top. Thin-history customers
 * (< PAY_SPEED_MIN_SAMPLES payments) sit muted at the bottom of the same
 * list with a "—" median, because their forecasts run on the company
 * median.
 */

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

function summaryTile(label: ReactNode, stat: PaySpeedStat | null) {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '0.5rem 0.6rem',
        textAlign: 'center',
        background: 'var(--bg-muted)',
      }}
    >
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.3rem' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.2rem', fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>
        {stat ? `~${stat.medianDays}d` : '—'}
      </div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
        {stat ? `${stat.samples} ${stat.samples === 1 ? 'payment' : 'payments'}` : 'no data'}
      </div>
    </div>
  )
}

const GAP_TONE_COLORS: Record<ReturnType<typeof receiptGapTone>, { bg: string; fg: string }> = {
  fast: { bg: 'var(--bg-green-tint)', fg: 'var(--text-green-800)' },
  mid: { bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)' },
  slow: { bg: 'var(--bg-red-tint)', fg: 'var(--text-red-600)' },
  neutral: { bg: 'var(--bg-muted)', fg: 'var(--text-700)' },
}

/**
 * One payment as a row (v2.2288): gap badge + billed–paid dates, then the job
 * it belongs to (name · address). Clickable when the payload knows the job —
 * opens that job's detail. Pre-v7 payloads (no job fields) render dates only.
 */
function receiptRow(r: PayReceipt, companyMedian: number | null, key: number, onOpenJob?: (jobId: string) => void) {
  const tone = GAP_TONE_COLORS[receiptGapTone(r.gapDays, companyMedian)]
  const clickable = r.jobId != null && onOpenJob != null
  const open = () => {
    if (r.jobId != null && onOpenJob != null) onOpenJob(r.jobId)
  }
  return (
    <div
      key={key}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      title={
        `Billed ${formatYmdMonthDay(r.billedYmd)} → paid ${formatYmdMonthDay(r.paidYmd)} (+${r.gapDays} ${r.gapDays === 1 ? 'day' : 'days'})` +
        (clickable ? ' — open the job' : '')
      }
      onClick={(e) => {
        e.stopPropagation()
        open()
      }}
      onKeyDown={(e) => {
        if (clickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          e.stopPropagation()
          open()
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.55rem',
        padding: '0.32rem 0.45rem',
        borderRadius: 6,
        fontSize: '0.76rem',
        cursor: clickable ? 'pointer' : 'default',
        borderTop: key > 0 ? '1px solid var(--border)' : 'none',
      }}
    >
      <span style={{ fontWeight: 700, borderRadius: 9999, padding: '0 6px', fontSize: '0.68rem', flexShrink: 0, fontVariantNumeric: 'tabular-nums', background: tone.bg, color: tone.fg }}>
        +{r.gapDays}
      </span>
      <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--text-700)', flexShrink: 0 }}>
        {formatYmdSlash(r.billedYmd)}–{formatYmdSlash(r.paidYmd)}
      </span>
      {(r.jobName || r.address) && (
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {r.jobName ? <span style={{ fontWeight: 650 }}>{r.jobName}</span> : null}
          {r.address ? <span style={{ color: 'var(--text-muted)' }}>{r.jobName ? ' · ' : ''}{r.address}</span> : null}
        </span>
      )}
      {clickable && <span aria-hidden style={{ color: 'var(--text-muted)', fontSize: '0.7rem', flexShrink: 0, marginLeft: (r.jobName || r.address) ? 0 : 'auto' }}>›</span>}
    </div>
  )
}

const panelLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.62rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-muted)',
  margin: '0.35rem 0 0.1rem',
}

/** The expanded panel under a customer row: what they owe now (per job, v2.2382), the payments behind their median, or the why-empty note. */
function receiptsPanel(
  c: PaySpeedCustomerRow,
  companyMedian: number | null,
  striped: boolean,
  onOpenBills?: () => void,
  onOpenJob?: (jobId: string) => void,
  bills?: OpenBill[],
) {
  const hasBills = bills != null && bills.length > 0
  return (
    <div
      style={{
        padding: '0.1rem 0.5rem 0.55rem 2rem',
        background: striped ? 'var(--bg-muted)' : 'transparent',
        borderRadius: '0 0 6px 6px',
      }}
    >
      {hasBills && (
        <>
          <span style={panelLabelStyle}>Owes now — by job</span>
          {bills.map((b, i) => openBillRow(b, i, onOpenJob))}
        </>
      )}
      {hasBills && <span style={panelLabelStyle}>Paid before — the payments behind the median</span>}
      {c.receipts.length > 0 ? (
        c.receipts.map((r, i) => receiptRow(r, companyMedian, i, onOpenJob))
      ) : (
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          {c.samples > 0
            ? 'Payment dates aren’t available yet — reload once the updated pay-speed lookup is live.'
            : 'No invoice-linked payments in the last 12 months — nothing measurable yet.'}
        </span>
      )}
      {onOpenBills && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onOpenBills()
          }}
          style={{
            border: 'none',
            background: 'none',
            padding: 0,
            marginTop: '0.35rem',
            cursor: 'pointer',
            color: 'var(--text-link)',
            fontSize: '0.72rem',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          See these bills on the board →
        </button>
      )}
    </div>
  )
}


/** Bill-tone colors for the money-waiting bars and badges (saturated status colors stay literal). */
const BILL_TONE: Record<OpenBillTone, { bar: string; bg: string; fg: string }> = {
  ok: { bar: '#4caf7d', bg: 'var(--bg-green-tint)', fg: 'var(--text-green-800)' },
  warn: { bar: '#d97706', bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)' },
  late: { bar: '#e05252', bg: 'var(--bg-red-tint)', fg: 'var(--text-red-600)' },
  undated: { bar: 'var(--border-strong)', bg: 'var(--bg-muted)', fg: 'var(--text-muted)' },
}

/** One open bill as a row: wait badge + job (name · address) + billed date + open $. Clickable → the job. */
function openBillRow(b: OpenBill, key: number, onOpenJob?: (jobId: string) => void) {
  const tone = BILL_TONE[b.tone]
  const clickable = b.jobId != null && onOpenJob != null
  const open = () => {
    if (b.jobId != null && onOpenJob != null) onOpenJob(b.jobId)
  }
  return (
    <div
      key={key}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      title={
        `${b.jobName}${b.address ? ` · ${b.address}` : ''} — ${formatUsdNoCents(b.open)} open, ` +
        (b.billedYmd ? `billed ${formatYmdMonthDay(b.billedYmd)}, waiting ${b.waitDays}d` : 'no bill date yet') +
        (clickable ? ' — open the job' : '')
      }
      onClick={(e) => {
        e.stopPropagation()
        open()
      }}
      onKeyDown={(e) => {
        if (clickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          e.stopPropagation()
          open()
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.55rem',
        padding: '0.32rem 0.45rem',
        borderRadius: 6,
        fontSize: '0.76rem',
        cursor: clickable ? 'pointer' : 'default',
        borderTop: key > 0 ? '1px solid var(--border)' : 'none',
      }}
    >
      <span style={{ fontWeight: 800, borderRadius: 9999, padding: '0 7px', fontSize: '0.68rem', flexShrink: 0, fontVariantNumeric: 'tabular-nums', background: tone.bg, color: tone.fg }}>
        {b.waitDays != null ? `${b.waitDays}d` : '—'}
      </span>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <span style={{ fontWeight: 650 }}>{b.jobName}</span>
        {b.address ? <span style={{ color: 'var(--text-muted)' }}> · {b.address}</span> : null}
      </span>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
        {b.billedYmd ? `billed ${formatYmdSlash(b.billedYmd)}` : 'no date'}
      </span>
      <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{formatUsdNoCents(b.open)}</span>
      {clickable && <span aria-hidden style={{ color: 'var(--text-muted)', fontSize: '0.7rem', flexShrink: 0 }}>›</span>}
    </div>
  )
}

/** Distinct jobs behind a customer's bills (several bills can share one job). */
function distinctJobCount(bills: OpenBill[]): number {
  return new Set(bills.map((b) => b.jobId ?? `#${b.jobName}`)).size
}


const ROW_GRID = 'minmax(130px, 1.4fr) 70px 80px 100px'

export default function PaySpeedsBreakdownModal({
  rows,
  paySpeeds,
  todayYmd,
  onClose,
  onOpenCustomerBills,
  onOpenJobDetail,
  canExcludePayments = false,
  isDev = false,
  onOpenJobStacked,
  onSpeedsChanged,
}: {
  rows: StageRow[]
  paySpeeds: PaySpeedData | null
  /** Company-timezone today (YYYY-MM-DD) — the drift chart's live-wait clock. */
  todayYmd: string
  onClose: () => void
  /** Jump the board to a customer's bills (closes both modals upstream). */
  onOpenCustomerBills?: (customerName: string) => void
  /** Open one payment's job detail (closes both modals upstream; v2.2288). */
  onOpenJobDetail?: (jobId: string) => void
  /** Devs + master techs may exclude payments in the Data health drill-down (v2.2290). */
  canExcludePayments?: boolean
  /** Devs only: the drill-down's ⚙ No Count Date setting (v2.2303). */
  isDev?: boolean
  /** Open a drill-down row's job STACKED above the modals, with a refresh-on-save callback (v2.2311). */
  onOpenJobStacked?: (jobId: string, onSaved: () => void) => void
  /** Refetch the pay-speeds RPC after an exclusion toggles, so medians update live. */
  onSpeedsChanged?: () => void
}) {
  const breakdown = useMemo(() => buildPaySpeedsBreakdown(rows, paySpeeds), [rows, paySpeeds])
  // One list: real medians slowest-first, then thin-history customers
  // (muted, "—" median) biggest open $ first.
  const merged = useMemo(() => [...breakdown.ranked, ...breakdown.thin], [breakdown])
  const money = useMemo(() => buildMoneyWaiting(rows, paySpeeds, todayYmd), [rows, paySpeeds, todayYmd])
  // Per-customer open bills for the "By customer" expansions — every customer
  // with open money, not just the off-pace ones (v2.2382).
  const billsByCustomer = useMemo(() => openBillsForCustomers(rows, paySpeeds, todayYmd), [rows, paySpeeds, todayYmd])
  // Money-waiting row expansion (separate from the receipts toggle below —
  // the two lists key by the same customer ids).
  const [openMoneyRows, setOpenMoneyRows] = useState<Record<string, boolean>>({})
  const toggleMoneyRow = (customerId: string) =>
    setOpenMoneyRows((prev) => ({ ...prev, [customerId]: !prev[customerId] }))
  // ≤640px: the 4-column grid and full-width chart are unreadable — rows restack
  // into two-line cards and the chart keeps its size behind sideways scroll.
  const isMobile = useIsMobile()
  // Per-customer receipts toggle (row click) — the payments behind each median.
  const [openReceipts, setOpenReceipts] = useState<Record<string, boolean>>({})
  const [dataHealthOpen, setDataHealthOpen] = useState(false)
  const toggleReceipts = (customerId: string) =>
    setOpenReceipts((prev) => ({ ...prev, [customerId]: !prev[customerId] }))
  const companyMedian = paySpeeds?.company?.medianDays ?? null
  const quality = paySpeeds?.quality ?? null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pay speeds breakdown"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 12,
          border: '1px solid var(--border)',
          width: isMobile ? 'calc(100vw - 0.75rem)' : 'min(720px, calc(100vw - 2rem))',
          maxHeight: isMobile ? '94vh' : 'min(84vh, 900px)',
          overflowY: 'auto',
          padding: isMobile ? '0.9rem 0.8rem 1rem' : '1.1rem 1.25rem 1.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Pay speeds</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close pay speeds breakdown"
            style={{ marginLeft: 'auto', border: 'none', background: 'none', color: 'var(--text-muted)', fontSize: '1.05rem', cursor: 'pointer', lineHeight: 1, padding: '0.15rem' }}
          >
            ✕
          </button>
        </div>
        <p style={{ margin: '0.3rem 0 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '68ch' }}>
          Median days from bill to payment, per customer, last 12 months — the clock the Payment forecast runs on. A
          customer under {PAY_SPEED_MIN_SAMPLES} payments falls back to the company median.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem', marginBottom: '0.6rem' }}>
          {summaryTile(<span style={{ color: 'var(--text-700)' }}>Company</span>, paySpeeds?.company ?? null)}
          {summaryTile(segTag('residential'), paySpeeds?.segments.residential ?? null)}
          {summaryTile(segTag('commercial'), paySpeeds?.segments.commercial ?? null)}
        </div>

        {quality && (
          // The data-health line (v2.2259, mockup-approved): one quiet row —
          // the good number leads as a meter; only the two counts the office
          // can act on wear amber; quarantined stays plain (nothing shrinks
          // it directly). Every stat says what to do about it on hover.
          // Clickable since v2.2290: the whole strip opens the transactions
          // drill-down (exclude from the math / open the job to fix it).
          <div
            role="button"
            tabIndex={0}
            aria-label="See the transactions behind the data health numbers"
            onClick={() => setDataHealthOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setDataHealthOpen(true)
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem 0.9rem',
              flexWrap: 'wrap',
              marginBottom: '1rem',
              padding: '0.45rem 0.7rem',
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: 'var(--bg-muted)',
              fontSize: '0.76rem',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Data health
            </span>
            <span
              title={`${quality.measurable} of ${quality.payments12mo} payments in the last 12 months carry a verified bill→paid pair the medians can use.`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap', cursor: 'help' }}
            >
              <b style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-700)' }}>
                {quality.measurable} of {quality.payments12mo}
              </b>{' '}
              measurable ({quality.payments12mo > 0 ? Math.round((quality.measurable / quality.payments12mo) * 100) : 0}%)
            </span>
            {quality.unlinked > 0 && (
              <span
                title="Payments missing info — not applied to any bill, or on a bill with no date — so they can’t feed pay speeds. Fix them in the drill-down or from each job’s Bill tab."
                style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.3rem', whiteSpace: 'nowrap', cursor: 'help' }}
              >
                <span
                  style={{
                    background: 'var(--bg-amber-tint)',
                    color: 'var(--text-amber-800)',
                    borderRadius: 9999,
                    padding: '0 6px',
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {quality.unlinked}
                </span>
                payments missing info
              </span>
            )}
            {quality.undatedInvoices > 0 && (
              <span
                title="Billed/paid bills with no bill date at all — their payments can’t be measured. Date them from the job, or via Settings → HCP reconcile for HCP-era bills."
                style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.3rem', whiteSpace: 'nowrap', cursor: 'help' }}
              >
                <span
                  style={{
                    background: 'var(--bg-amber-tint)',
                    color: 'var(--text-amber-800)',
                    borderRadius: 9999,
                    padding: '0 6px',
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {quality.undatedInvoices}
                </span>
                undated bills
              </span>
            )}
            {quality.quarantined > 0 && (
              <span
                title="Import-era same-day pairs excluded from the math because their dates can’t be verified. This only shrinks when a verified date replaces one (Settings → HCP reconcile)."
                style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.3rem', whiteSpace: 'nowrap', cursor: 'help' }}
              >
                <b style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-700)' }}>{quality.quarantined}</b> quarantined
              </span>
            )}
            {quality.excluded > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.3rem', whiteSpace: 'nowrap' }}>
                <b style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-700)' }}>{quality.excluded}</b> excluded
              </span>
            )}
            <span style={{ marginLeft: 'auto', whiteSpace: 'nowrap', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-link)' }}>
              see the transactions ›
            </span>
          </div>
        )}

        {dataHealthOpen && (
          <PaySpeedDataHealthModal
            onClose={() => setDataHealthOpen(false)}
            onOpenJobDetail={onOpenJobDetail}
            onOpenJobStacked={onOpenJobStacked}
            canExclude={canExcludePayments}
            isDev={isDev}
            onChanged={onSpeedsChanged}
          />
        )}

        {money && (money.rows.length > 0 || money.onPaceCount > 0) ? (
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.8rem 0.8rem 0.6rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-700)' }}>Money waiting</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                slowest first · the bar is their open bills, sized by dollars · click a row for each job they owe
              </span>
            </div>
            <div style={isMobile ? { overflowX: 'auto', WebkitOverflowScrolling: 'touch' } : undefined}>
              <div style={isMobile ? { minWidth: 560 } : undefined}>
                {money.rows.map((c: MoneyWaitingRow, i) => {
                  const expanded = !!openMoneyRows[c.customerId]
                  const jobs = distinctJobCount(c.bills)
                  const worst = BILL_TONE[billWaitTone(c.oldestWaitDays, c.baselineDays)]
                  return (
                    <div key={c.customerId}>
                      <div
                        role="button"
                        tabIndex={0}
                        aria-expanded={expanded}
                        title={
                          `${c.name} — oldest open bill has waited ${c.oldestWaitDays}d (` +
                          (c.ownMedianDays != null ? `they usually pay in ~${c.ownMedianDays}d` : `no history of their own — company pays in ~${money.companyMedianDays}d`) +
                          `) · ${formatUsdNoCents(c.open)} open on ${jobs} ${jobs === 1 ? 'job' : 'jobs'} — click for each job`
                        }
                        onClick={() => toggleMoneyRow(c.customerId)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            toggleMoneyRow(c.customerId)
                          }
                        }}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'auto minmax(120px, 170px) 1fr auto',
                          gap: '0.6rem',
                          alignItems: 'center',
                          padding: '0.4rem 0.45rem',
                          borderRadius: expanded ? '6px 6px 0 0' : 6,
                          background: i % 2 === 1 ? 'var(--bg-muted)' : 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        <span
                          aria-hidden
                          style={{ color: 'var(--text-muted)', fontSize: '0.6rem', width: '0.7em', display: 'inline-block', transform: expanded ? 'rotate(90deg)' : 'none' }}
                        >
                          ▶
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0, fontSize: '0.76rem' }}>
                          {segTag(c.segment)}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{c.name}</span>
                        </span>
                        <span style={{ display: 'flex', gap: 3, alignItems: 'center', height: 14 }}>
                          {c.bills.map((b, bi) => (
                            <span
                              key={bi}
                              title={`${b.jobName}${b.address ? ` · ${b.address}` : ''} — ${formatUsdNoCents(b.open)}, ${b.billedYmd ? `waiting ${b.waitDays}d` : 'no bill date'}`}
                              style={{
                                height: 12,
                                borderRadius: 3,
                                minWidth: 8,
                                width: `${c.open > 0 ? Math.max((b.open / c.open) * 100, 3) : 3}%`,
                                background: BILL_TONE[b.tone].bar,
                                opacity: b.tone === 'undated' ? 0.7 : 0.85,
                              }}
                            />
                          ))}
                        </span>
                        <span style={{ textAlign: 'right', fontSize: '0.74rem', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          <b style={{ color: worst.fg }}>{c.oldestWaitDays}d waiting</b>
                          <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            {c.ownMedianDays != null ? `usually ~${c.ownMedianDays}d` : `no history — vs company ~${money.companyMedianDays}d`} ·{' '}
                            <b style={{ color: 'var(--text-700)' }}>{formatUsdNoCents(c.open)}</b> open on {jobs} {jobs === 1 ? 'job' : 'jobs'}
                          </span>
                        </span>
                      </div>
                      {expanded && (
                        <div
                          style={{
                            padding: '0.1rem 0.5rem 0.55rem 2rem',
                            background: i % 2 === 1 ? 'var(--bg-muted)' : 'transparent',
                            borderRadius: '0 0 6px 6px',
                          }}
                        >
                          {c.bills.map((b, bi) => openBillRow(b, bi, onOpenJobDetail))}
                          {onOpenCustomerBills && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                onOpenCustomerBills(c.name)
                              }}
                              style={{ border: 'none', background: 'none', padding: 0, marginTop: '0.35rem', cursor: 'pointer', color: 'var(--text-link)', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}
                            >
                              See these bills on the board →
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.9rem', fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0.5rem 0 0.1rem', flexWrap: 'wrap' }}>
              <span>bill color:</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: BILL_TONE.ok.bar, display: 'inline-block' }} /> on their pace
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: BILL_TONE.warn.bar, display: 'inline-block' }} /> over their usual
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: BILL_TONE.late.bar, display: 'inline-block' }} /> twice it or more
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: BILL_TONE.undated.bar, display: 'inline-block' }} /> no bill date
              </span>
            </div>
            {money.onPaceCount > 0 && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                {money.onPaceCount} more {money.onPaceCount === 1 ? 'customer is' : 'customers are'} on their usual pace ·{' '}
                {formatUsdNoCents(money.onPaceOpen)} open · nothing to chase
              </div>
            )}
          </div>
        ) : (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
            No open billed money to chart yet.
          </p>
        )}

        {merged.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', margin: '0 0 0.4rem', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '0.85rem' }}>By customer — slowest first</h3>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                the top of this list is your follow-up list · click a row to see the payments behind its median · — = under{' '}
                {PAY_SPEED_MIN_SAMPLES} payments, forecast uses the company median
                {companyMedian != null ? ` (~${companyMedian}d)` : ''}
              </span>
            </div>
            <div
              style={{
                display: isMobile ? 'none' : 'grid',
                gridTemplateColumns: ROW_GRID,
                gap: '0.6rem',
                padding: '0 0.5rem 0.25rem',
                fontSize: '0.66rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-muted)',
                fontWeight: 600,
              }}
            >
              <span>Customer</span>
              <span style={{ textAlign: 'right' }}>Median</span>
              <span style={{ textAlign: 'right' }}>Payments</span>
              <span style={{ textAlign: 'right' }}>Open now</span>
            </div>
            {merged.map((c, i) => {
              const thin = c.medianDays == null
              const expanded = !!openReceipts[c.customerId]
              const caret = (
                <span
                  aria-hidden
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.6rem',
                    width: '0.7em',
                    flexShrink: 0,
                    display: 'inline-block',
                    transform: expanded ? 'rotate(90deg)' : 'none',
                  }}
                >
                  ▶
                </span>
              )
              const median = thin ? (
                <span style={{ textAlign: 'right', flexShrink: 0, color: 'var(--text-muted)' }}>—</span>
              ) : (
                <span
                  style={{
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    textAlign: 'right',
                    flexShrink: 0,
                    color: (c.medianDays ?? 0) > 30 ? 'var(--text-red-600)' : 'var(--text)',
                  }}
                >
                  ~{c.medianDays}d
                </span>
              )
              return (
              <div key={c.customerId}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={expanded}
                  title={
                    thin
                      ? expanded
                        ? 'Hide this customer’s payments'
                        : 'Show this customer’s payments'
                      : expanded
                        ? 'Hide the payments behind this median'
                        : 'Show the payments behind this median'
                  }
                  onClick={() => toggleReceipts(c.customerId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggleReceipts(c.customerId)
                    }
                  }}
                  style={{
                    ...(isMobile
                      ? {}
                      : { display: 'grid', gridTemplateColumns: ROW_GRID, gap: '0.6rem', alignItems: 'center' }),
                    padding: isMobile ? '0.5rem 0.5rem' : '0.42rem 0.5rem',
                    borderRadius: expanded ? '6px 6px 0 0' : 6,
                    fontSize: '0.8rem',
                    color: thin ? 'var(--text-muted)' : undefined,
                    background: i % 2 === 1 ? 'var(--bg-muted)' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  {isMobile ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
                        {caret}
                        {segTag(c.segment)}
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.name}
                        </span>
                        {median}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: '0.3rem 0 0 1.05rem' }}>
                        <span
                          style={{
                            color: 'var(--text-muted)',
                            fontSize: '0.72rem',
                            fontVariantNumeric: 'tabular-nums',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {c.samples} {c.samples === 1 ? 'pmt' : 'pmts'} · {formatUsdNoCents(c.open)} open
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
                        {caret}
                        {segTag(c.segment)}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                      </span>
                      {median}
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {c.samples} {c.samples === 1 ? 'pmt' : 'pmts'}
                      </span>
                      <span style={{ color: 'var(--text-700)', fontSize: '0.76rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {formatUsdNoCents(c.open)}
                      </span>
                    </>
                  )}
                </div>
                {expanded &&
                  receiptsPanel(
                    c,
                    companyMedian,
                    i % 2 === 1,
                    onOpenCustomerBills ? () => onOpenCustomerBills(c.name) : undefined,
                    onOpenJobDetail,
                    billsByCustomer.get(c.customerId),
                  )}
              </div>
              )
            })}
          </>
        )}

      </div>
    </div>
  )
}
