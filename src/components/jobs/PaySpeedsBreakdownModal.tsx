import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import type { StageRow } from '../../lib/jobsStagesBoard'
import type { CustomerSegment, PayReceipt, PaySpeedData, PaySpeedStat } from '../../lib/jobs/billedExpectedPay'
import { PAY_SPEED_MIN_SAMPLES, formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import {
  buildPaySpeedsBreakdown,
  bucketPaySpeeds,
  formatYmdSlash,
  receiptGapTone,
  type PaySpeedCustomerRow,
} from '../../lib/jobs/paySpeedsBreakdown'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import PaySpeedDataHealthModal from './PaySpeedDataHealthModal'
import { useIsMobile } from '../../hooks/useIsMobile'

/**
 * The pay-speeds drill-down (owner-approved mockup, v2.2022): opened from
 * the Payment forecast's pay-speeds strip. Three tiles echo the strip, a
 * distribution chart shows where customers land (two variants behind
 * pills — every-customer-a-dot, or count-by-speed-bucket), and the ranked
 * list puts the slowest payers with their open dollars on top. Thin-history
 * customers (< PAY_SPEED_MIN_SAMPLES payments) sit in their own muted tier
 * because their forecasts run on the company median.
 */

const RES_COLOR = '#3b82f6'
const COMM_COLOR = '#d97706'

function segColor(segment: CustomerSegment | null): string {
  if (segment === 'residential') return RES_COLOR
  if (segment === 'commercial') return COMM_COLOR
  return 'var(--text-muted)'
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

/** The expanded receipts panel under a customer row (or the why-empty note). */
function receiptsPanel(
  c: PaySpeedCustomerRow,
  companyMedian: number | null,
  striped: boolean,
  onOpenBills?: () => void,
  onOpenJob?: (jobId: string) => void,
) {
  return (
    <div
      style={{
        padding: '0.1rem 0.5rem 0.55rem 2rem',
        background: striped ? 'var(--bg-muted)' : 'transparent',
        borderRadius: '0 0 6px 6px',
      }}
    >
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

function dotRadius(open: number): number {
  return open >= 10000 ? 11 : open >= 3000 ? 8 : 5.5
}

function DotChart({ ranked, companyMedian }: { ranked: PaySpeedCustomerRow[]; companyMedian: number | null }) {
  const W = 640
  const H = 150
  const L = 26
  const R = 20
  const axisY = H - 28
  const maxD = Math.max(48, ...ranked.map((c) => (c.medianDays ?? 0) + 4))
  const x = (d: number) => L + (d / maxD) * (W - L - R)
  const lanes = { res: axisY - 26, comm: axisY - 62 }
  const ticks: number[] = []
  for (let t = 0; t <= maxD - 4; t += 10) ticks.push(t)
  const slowest = ranked[0]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Each customer's median days to pay, as a dot on a days axis">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} y1={18} x2={x(t)} y2={axisY} stroke="var(--border)" strokeWidth={1} />
          <text x={x(t)} y={axisY + 16} textAnchor="middle" fontSize={10} fill="var(--text-muted)">
            {t}d
          </text>
        </g>
      ))}
      {companyMedian != null && (
        <>
          <line x1={x(companyMedian)} y1={12} x2={x(companyMedian)} y2={axisY} stroke="var(--text-muted)" strokeWidth={1.5} strokeDasharray="4 3" />
          <text x={x(companyMedian)} y={10} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--text-muted)">
            company ~{companyMedian}d
          </text>
        </>
      )}
      {ranked.map((c, i) => {
        const lane = c.segment === 'residential' ? lanes.res : lanes.comm
        const cy = lane + (i % 2 === 0 ? 0 : 12)
        return (
          <circle key={c.customerId} cx={x(c.medianDays ?? 0)} cy={cy} r={dotRadius(c.open)} fill={segColor(c.segment)} stroke="var(--surface)" strokeWidth={2}>
            <title>{`${c.name} — pays in ~${c.medianDays}d · ${c.samples} payments · ${formatUsdNoCents(c.open)} open`}</title>
          </circle>
        )
      })}
      {slowest && slowest.medianDays != null && (
        <text x={x(slowest.medianDays)} y={lanes.comm - 14} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--text-700)">
          {slowest.name} · {slowest.medianDays}d
        </text>
      )}
    </svg>
  )
}

function BucketChart({ ranked }: { ranked: PaySpeedCustomerRow[] }) {
  const buckets = bucketPaySpeeds(ranked)
  const W = 640
  const H = 170
  const L = 26
  const R = 14
  const axisY = H - 26
  const top = 22
  const bw = (W - L - R) / buckets.length
  const maxN = Math.max(1, ...buckets.map((b) => b.res.length + b.comm.length))
  const yh = (n: number) => (n / maxN) * (axisY - top)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Customer count by pay-speed bucket, residential and commercial stacked">
      {buckets.map((b, i) => {
        const cx = L + i * bw + bw / 2
        const barW = Math.min(bw - 18, 46)
        let yCur = axisY
        const segments: ReactNode[] = []
        for (const [seg, arr] of [
          ['commercial', b.comm],
          ['residential', b.res],
        ] as const) {
          if (!arr.length) continue
          const h = yh(arr.length)
          yCur -= h
          segments.push(
            <rect key={seg} x={cx - barW / 2} y={yCur + 1} width={barW} height={Math.max(h - 2, 2)} rx={4} fill={seg === 'residential' ? RES_COLOR : COMM_COLOR}>
              <title>{`${b.label} · ${seg === 'residential' ? 'Residential' : 'Commercial'}: ${arr.map((c) => `${c.name} (~${c.medianDays}d)`).join(', ')}`}</title>
            </rect>,
          )
        }
        const total = b.res.length + b.comm.length
        return (
          <g key={b.label}>
            {segments}
            {total > 0 && (
              <text x={cx} y={yCur - 5} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--text-700)">
                {total}
              </text>
            )}
            <text x={cx} y={axisY + 15} textAnchor="middle" fontSize={10} fill="var(--text-muted)">
              {b.label}
            </text>
          </g>
        )
      })}
      <line x1={L} y1={axisY} x2={W - R} y2={axisY} stroke="var(--border-strong)" strokeWidth={1} />
    </svg>
  )
}

const ROW_GRID = 'minmax(130px, 1.4fr) 58px 70px 82px minmax(70px, 1fr)'

export default function PaySpeedsBreakdownModal({
  rows,
  paySpeeds,
  onClose,
  onOpenCustomerBills,
  onOpenJobDetail,
  canExcludePayments = false,
  onSpeedsChanged,
}: {
  rows: StageRow[]
  paySpeeds: PaySpeedData | null
  onClose: () => void
  /** Jump the board to a customer's bills (closes both modals upstream). */
  onOpenCustomerBills?: (customerName: string) => void
  /** Open one payment's job detail (closes both modals upstream; v2.2288). */
  onOpenJobDetail?: (jobId: string) => void
  /** Devs + master techs may exclude payments in the Data health drill-down (v2.2290). */
  canExcludePayments?: boolean
  /** Refetch the pay-speeds RPC after an exclusion toggles, so medians update live. */
  onSpeedsChanged?: () => void
}) {
  const breakdown = useMemo(() => buildPaySpeedsBreakdown(rows, paySpeeds), [rows, paySpeeds])
  // ≤640px: the 5-column grid and full-width SVGs are unreadable — rows restack
  // into two-line cards and the charts keep their size behind sideways scroll.
  const isMobile = useIsMobile()
  const [variant, setVariant] = useState<'dots' | 'buckets'>('dots')
  // Per-customer receipts toggle (row click) — the payments behind each median.
  const [openReceipts, setOpenReceipts] = useState<Record<string, boolean>>({})
  const [dataHealthOpen, setDataHealthOpen] = useState(false)
  const toggleReceipts = (customerId: string) =>
    setOpenReceipts((prev) => ({ ...prev, [customerId]: !prev[customerId] }))
  const companyMedian = paySpeeds?.company?.medianDays ?? null
  const quality = paySpeeds?.quality ?? null

  const pillStyle = (active: boolean): CSSProperties => ({
    border: `1px solid ${active ? 'var(--text-link)' : 'var(--border-strong)'}`,
    background: active ? 'var(--text-link)' : 'var(--surface)',
    color: active ? '#fff' : 'var(--text-muted)',
    borderRadius: 9999,
    fontSize: '0.72rem',
    fontWeight: 600,
    padding: '0.2rem 0.7rem',
    cursor: 'pointer',
  })

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
              <span style={{ width: 72, height: 6, borderRadius: 4, background: 'var(--border)', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                <span
                  style={{
                    position: 'absolute',
                    inset: '0 auto 0 0',
                    width: `${quality.payments12mo > 0 ? Math.round((quality.measurable / quality.payments12mo) * 100) : 0}%`,
                    background: 'var(--text-green-800)',
                    borderRadius: 4,
                  }}
                />
              </span>
              <b style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-700)' }}>
                {quality.measurable} of {quality.payments12mo}
              </b>{' '}
              measurable ({quality.payments12mo > 0 ? Math.round((quality.measurable / quality.payments12mo) * 100) : 0}%)
            </span>
            <span
              title="Payments not applied to any bill — they can’t feed pay speeds or pay a bill down. Link them from each job’s payments table."
              style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.3rem', whiteSpace: 'nowrap', cursor: 'help' }}
            >
              <span
                style={{
                  background: quality.unlinked > 0 ? 'var(--bg-amber-tint)' : 'var(--bg-muted)',
                  color: quality.unlinked > 0 ? 'var(--text-amber-800)' : 'var(--text-muted)',
                  borderRadius: 9999,
                  padding: '0 6px',
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {quality.unlinked}
              </span>
              unlinked payments
            </span>
            <span
              title="Billed/paid bills with no bill date at all — their payments can’t be measured. Date them from the job, or via Settings → HCP reconcile for HCP-era bills."
              style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.3rem', whiteSpace: 'nowrap', cursor: 'help' }}
            >
              <span
                style={{
                  background: quality.undatedInvoices > 0 ? 'var(--bg-amber-tint)' : 'var(--bg-muted)',
                  color: quality.undatedInvoices > 0 ? 'var(--text-amber-800)' : 'var(--text-muted)',
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
            <span
              title="Import-era same-day pairs excluded from the math because their dates can’t be verified. This only shrinks when a verified date replaces one (Settings → HCP reconcile)."
              style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.3rem', whiteSpace: 'nowrap', cursor: 'help' }}
            >
              <b style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-700)' }}>{quality.quarantined}</b> quarantined
            </span>
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
            canExclude={canExcludePayments}
            onChanged={onSpeedsChanged}
          />
        )}

        {breakdown.ranked.length > 0 ? (
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.8rem 0.8rem 0.5rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-700)', marginRight: 'auto' }}>
                Where customers land
              </span>
              <button type="button" aria-pressed={variant === 'dots'} onClick={() => setVariant('dots')} style={pillStyle(variant === 'dots')}>
                Every customer a dot
              </button>
              <button type="button" aria-pressed={variant === 'buckets'} onClick={() => setVariant('buckets')} style={pillStyle(variant === 'buckets')}>
                Count by speed bucket
              </button>
            </div>
            <div style={isMobile ? { overflowX: 'auto', WebkitOverflowScrolling: 'touch' } : undefined}>
              <div style={isMobile ? { minWidth: 560 } : undefined}>
                {variant === 'dots' ? (
                  <DotChart ranked={breakdown.ranked} companyMedian={companyMedian} />
                ) : (
                  <BucketChart ranked={breakdown.ranked} />
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.9rem', fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0.3rem 0 0.1rem', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: 9, height: 9, borderRadius: 9999, background: RES_COLOR, display: 'inline-block' }} /> Residential
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: 9, height: 9, borderRadius: 9999, background: COMM_COLOR, display: 'inline-block' }} /> Commercial
              </span>
              <span>
                {variant === 'dots' ? '│ company median · dot size = open $ on the board' : '│ bar = how many customers pay at that speed'}
              </span>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
            No customer with open billed money has enough payment history to chart yet.
          </p>
        )}

        {breakdown.ranked.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', margin: '0 0 0.4rem', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '0.85rem' }}>By customer — slowest first</h3>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                the top of this list is your follow-up list · click a row to see the payments behind its median
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
              <span />
            </div>
            {breakdown.ranked.map((c, i) => {
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
              const bar = (
                <span
                  style={{
                    height: 8,
                    borderRadius: 4,
                    background: 'var(--border)',
                    overflow: 'hidden',
                    position: 'relative',
                    ...(isMobile ? { flex: 1 } : {}),
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      inset: '0 auto 0 0',
                      width: `${breakdown.maxDays > 0 ? ((c.medianDays ?? 0) / breakdown.maxDays) * 100 : 0}%`,
                      borderRadius: 4,
                      background: segColor(c.segment),
                    }}
                  />
                </span>
              )
              const median = (
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
                  title={expanded ? 'Hide the payments behind this median' : 'Show the payments behind this median'}
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
                          {c.samples} pmts · {formatUsdNoCents(c.open)} open
                        </span>
                        {bar}
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
                        {c.samples} pmts
                      </span>
                      <span style={{ color: 'var(--text-700)', fontSize: '0.76rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {formatUsdNoCents(c.open)}
                      </span>
                      {bar}
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
                  )}
              </div>
              )
            })}
          </>
        )}

        {breakdown.thin.length > 0 && (
          <div style={{ marginTop: '0.9rem' }}>
            <p style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 0.3rem' }}>
              Thin history — under {PAY_SPEED_MIN_SAMPLES} payments, forecast uses the company median
              {companyMedian != null ? ` (~${companyMedian}d)` : ''}
            </p>
            {breakdown.thin.map((c) => (
              <div key={c.customerId}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={!!openReceipts[c.customerId]}
                  title={openReceipts[c.customerId] ? 'Hide this customer’s payments' : 'Show this customer’s payments'}
                  onClick={() => toggleReceipts(c.customerId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggleReceipts(c.customerId)
                    }
                  }}
                  style={{
                    ...(isMobile
                      ? { display: 'flex', alignItems: 'center', gap: '0.45rem' }
                      : { display: 'grid', gridTemplateColumns: ROW_GRID, gap: '0.6rem', alignItems: 'center' }),
                    padding: isMobile ? '0.42rem 0.5rem' : '0.32rem 0.5rem',
                    fontSize: '0.78rem',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    borderRadius: 6,
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0, ...(isMobile ? { flex: 1 } : {}) }}>
                    <span
                      aria-hidden
                      style={{
                        fontSize: '0.6rem',
                        width: '0.7em',
                        flexShrink: 0,
                        display: 'inline-block',
                        transform: openReceipts[c.customerId] ? 'rotate(90deg)' : 'none',
                      }}
                    >
                      ▶
                    </span>
                    {segTag(c.segment)}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                  </span>
                  {isMobile ? (
                    <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {c.samples} {c.samples === 1 ? 'pmt' : 'pmts'} ·{' '}
                      <span style={{ color: 'var(--text-700)' }}>{formatUsdNoCents(c.open)}</span>
                    </span>
                  ) : (
                    <>
                      <span style={{ textAlign: 'right' }}>—</span>
                      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {c.samples} {c.samples === 1 ? 'pmt' : 'pmts'}
                      </span>
                      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-700)' }}>
                        {formatUsdNoCents(c.open)}
                      </span>
                      <span />
                    </>
                  )}
                </div>
                {openReceipts[c.customerId] &&
                  receiptsPanel(
                    c,
                    companyMedian,
                    false,
                    onOpenCustomerBills ? () => onOpenCustomerBills(c.name) : undefined,
                    onOpenJobDetail,
                  )}
              </div>
            ))}
          </div>
        )}

        <p
          style={{
            marginTop: '0.9rem',
            marginBottom: 0,
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
            borderTop: '1px solid var(--border)',
            paddingTop: '0.6rem',
          }}
        >
          Speeds come from recorded payments (bill date → paid date). "Open now" is what's sitting in Billed Awaiting
          Payment for that customer today. Expanded receipts read (+16) 05/01–05/17 — billed date to the day money hit;
          the gap is green at or under the company median, amber above it, red at twice it or more.
        </p>
      </div>
    </div>
  )
}
