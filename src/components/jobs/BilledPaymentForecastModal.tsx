import { useMemo, useState } from 'react'
import type { StageRow } from '../../lib/jobsStagesBoard'
import type { CustomerSegment, PaySpeedData, PaySpeedStat, PromisedPayDate } from '../../lib/jobs/billedExpectedPay'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import {
  buildBilledPaymentForecast,
  type ForecastBucket,
  type ForecastBucketKey,
  type ForecastRow,
} from '../../lib/jobs/billedPaymentForecast'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { summarizeNoticeMonths, noticeStateText, workMonthLabel, type JobWorkMonths } from '../../lib/jobs/forecastWorkMonths'
import ForecastWorkMonthsPanel, { ForecastNoticeChip } from './ForecastWorkMonthsPanel'
import PaySpeedsBreakdownModal from './PaySpeedsBreakdownModal'

/**
 * "Payment forecast" on the Billed Awaiting Payment header: open dollars
 * bucketed by expected payment date (bill date + customer pay speed — the
 * expected-pay chips' model). Past-expected money is the follow-up queue;
 * the week buckets are the cash-in forecast. Click a row to jump the board
 * to that bill (the aging chart's jump).
 */

function bucketTileColors(b: ForecastBucket): { bg: string; fg: string; border: string } {
  if (b.key === 'past' && b.rows.length > 0) {
    return { bg: 'var(--bg-red-tint)', fg: 'var(--text-red-600)', border: 'transparent' }
  }
  if (b.key === 'thisWeek' && b.rows.length > 0) {
    return { bg: 'var(--bg-blue-tint)', fg: 'var(--text-blue-800)', border: 'transparent' }
  }
  return { bg: 'var(--surface)', fg: 'var(--text-700)', border: 'var(--border)' }
}

/** Small Res/Comm tag — the Customers surfaces' color convention (commercial = amber tint). */
function segmentTag(segment: CustomerSegment | null) {
  if (!segment) return null
  const comm = segment === 'commercial'
  return (
    <span
      title={comm ? 'Commercial customer' : 'Residential customer'}
      style={{
        fontSize: '0.65rem',
        fontWeight: 600,
        padding: '1px 6px',
        borderRadius: 9999,
        background: comm ? 'var(--bg-amber-tint)' : 'var(--bg-blue-tint)',
        color: comm ? 'var(--text-amber-800)' : 'var(--text-blue-800)',
        verticalAlign: 'middle',
      }}
    >
      {comm ? 'Comm' : 'Res'}
    </span>
  )
}

/** One "Company ~27d · 240 payments" cell of the pay-speeds strip. */
function speedCell(label: React.ReactNode, stat: PaySpeedStat | null, title: string) {
  return (
    <span title={title} style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.35rem', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
      {label}
      {stat ? (
        <>
          <strong style={{ fontVariantNumeric: 'tabular-nums' }}>~{stat.medianDays}d</strong>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {stat.samples} {stat.samples === 1 ? 'payment' : 'payments'}
          </span>
        </>
      ) : (
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>no data</span>
      )}
    </span>
  )
}

function rowDateLabel(r: ForecastRow): { text: string; color: string } {
  if (!r.model) return { text: 'no history', color: 'var(--text-muted)' }
  if (r.model.source === 'promised') {
    return r.model.state === 'late'
      ? { text: `${r.model.daysLate}d past promise`, color: 'var(--text-red-600)' }
      : { text: `✓ ${formatYmdMonthDay(r.model.expectedYmd)}`, color: 'var(--text-green-800)' }
  }
  if (r.model.state === 'late') return { text: `${r.model.daysLate}d late`, color: 'var(--text-red-600)' }
  return { text: `~${formatYmdMonthDay(r.model.expectedYmd)}`, color: 'var(--text-blue-800)' }
}

export default function BilledPaymentForecastModal({
  rows,
  loading,
  paySpeeds,
  promises,
  slipByCustomer,
  todayYmd,
  onClose,
  onOpenInvoice,
  onEmail,
  onOpenJobDetail,
  canExcludePayments,
  isDev,
  canEmailMoneyWaiting,
  onOpenJobStacked,
  onPaySpeedsChanged,
  workMonths,
  onOpenLienNotice,
}: {
  rows: StageRow[]
  /** True while any non-paid scope is still fetching — the totals can still grow. */
  loading?: boolean
  paySpeeds: PaySpeedData | null
  promises?: Record<string, PromisedPayDate> | null
  /** Their Word PR 3: customer id → usual slip in days; promised rows bucket by promise + slip. */
  slipByCustomer?: Record<string, number> | null
  todayYmd: string
  onClose: () => void
  onOpenInvoice: (invoiceId: string) => void
  /** Open one payment's job detail from the Pay speeds drill-down (v2.2288). */
  onOpenJobDetail?: (jobId: string) => void
  /** Devs + master techs may exclude payments in the Data health drill-down (v2.2290). */
  canExcludePayments?: boolean
  /** Devs only: the Data health ⚙ No Count Date setting (v2.2303). */
  isDev?: boolean
  /** Staff senders: Money waiting's "✉ Email this weekly…" (v2.2565). */
  canEmailMoneyWaiting?: boolean
  /** Open a drill-down row's job stacked above the modals, refreshing on save (v2.2311). */
  onOpenJobStacked?: (jobId: string, onSaved: () => void) => void
  /** Refetch pay speeds after an exclusion toggles (v2.2290). */
  onPaySpeedsChanged?: () => void
  /** Opens the Email… share modal (v2.2226) — passed only for sender roles. */
  onEmail?: () => void
  /**
   * Work months per job (the lien clock's evidence): a chevron on rows that
   * have sessions, a notice chip on sub rows with a month closing. Null while
   * loading; a job absent from the map has no sessions.
   */
  workMonths?: Record<string, JobWorkMonths> | null
  /** Opens the Lien instruments window on the § 53.056 notice tab for a job. */
  onOpenLienNotice?: (jobId: string) => void
}) {
  const forecast = useMemo(
    () => buildBilledPaymentForecast(rows, paySpeeds, todayYmd, promises, slipByCustomer),
    [rows, paySpeeds, todayYmd, promises, slipByCustomer],
  )
  const visibleBuckets = forecast.buckets.filter((b) => b.key !== 'unknown' || b.rows.length > 0)
  // Tile click-to-filter (v2.1943): a tile narrows the lists to just its
  // bucket; clicking it again (or Show all) restores every bucket.
  const [bucketFilter, setBucketFilter] = useState<ForecastBucketKey | null>(null)
  // Pay-speeds drill-down (v2.2022): the strip is now the door.
  const [paySpeedsOpen, setPaySpeedsOpen] = useState(false)
  const [paySpeedsHover, setPaySpeedsHover] = useState(false)
  // Work months (lien clock): which rows are open, and the one quiet line
  // above the buckets when a sub job's notice month is closing.
  const [openWorkMonths, setOpenWorkMonths] = useState<ReadonlySet<string>>(() => new Set())
  const openByJob = useMemo(() => {
    const out: Record<string, number> = {}
    for (const b of forecast.buckets) for (const r of b.rows) out[r.jobId] = (out[r.jobId] ?? 0) + r.open
    return out
  }, [forecast])
  const noticeSummary = useMemo(() => (workMonths ? summarizeNoticeMonths(workMonths, openByJob) : null), [workMonths, openByJob])
  const jobLabelById = useMemo(() => {
    const out: Record<string, string> = {}
    for (const b of forecast.buckets) for (const r of b.rows) out[r.jobId] = r.label
    return out
  }, [forecast])
  const toggleWorkMonths = (jobId: string) =>
    setOpenWorkMonths((prev) => {
      const next = new Set(prev)
      if (next.has(jobId)) next.delete(jobId)
      else next.add(jobId)
      return next
    })
  const listedBuckets = visibleBuckets.filter(
    (b) => b.rows.length > 0 && (bucketFilter == null || b.key === bucketFilter),
  )
  const filteredTitle = bucketFilter ? visibleBuckets.find((b) => b.key === bucketFilter)?.title : null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Billed Awaiting Payment payment forecast"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', padding: '1.25rem 1.5rem', borderRadius: 8, width: 'min(880px, calc(100vw - 2rem))', maxHeight: '92vh', overflow: 'auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Payment forecast</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {onEmail && (
              <button
                type="button"
                onClick={onEmail}
                title="Email this forecast to a teammate — now, scheduled, or weekly"
                aria-label="Email payment forecast"
                style={{
                  height: 30,
                  padding: '0 0.75rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 6,
                  background: 'var(--surface)',
                  cursor: 'pointer',
                  color: 'var(--text-700)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span aria-hidden>✉</span>
                Email…
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)', padding: 4 }}
            >
              ×
            </button>
          </div>
        </div>
        <p style={{ margin: '0.25rem 0 0.9rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Open billed dollars by expected payment date — the bill date plus each customer's median pay speed (last 12
          months). Click a tile to see just its bills; click a row to jump to that bill on the board.
        </p>
        {loading ? (
          <p style={{ margin: '0 0 0.9rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }} role="status" aria-busy>
            Loading the whole board — totals can still grow…
          </p>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))', gap: '0.6rem' }}>
          {visibleBuckets.map((b) => {
            const c = bucketTileColors(b)
            const active = bucketFilter === b.key
            const empty = b.rows.length === 0
            return (
              <button
                key={b.key}
                type="button"
                disabled={empty && !active}
                aria-pressed={active}
                title={
                  empty
                    ? 'No bills in this bucket'
                    : active
                      ? 'Show every bucket again'
                      : `Show only the ${b.title} bills`
                }
                onClick={() => setBucketFilter(active ? null : b.key)}
                style={{
                  background: c.bg,
                  border: `1px solid ${c.border}`,
                  outline: active ? '2px solid var(--text-link)' : 'none',
                  outlineOffset: -1,
                  borderRadius: 8,
                  padding: '0.6rem 0.75rem',
                  opacity: empty && !active ? 0.55 : 1,
                  textAlign: 'center',
                  cursor: empty && !active ? 'default' : 'pointer',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: c.fg }}>{b.title}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 650, color: c.fg, fontVariantNumeric: 'tabular-nums' }}>
                  {formatUsdNoCents(b.sum)}
                </div>
                <div style={{ fontSize: '0.72rem', color: c.fg }}>
                  {b.rows.length} {b.rows.length === 1 ? 'bill' : 'bills'}
                  {b.key === 'past' && b.rows.length > 0 ? ' · follow up' : ''}
                </div>
              </button>
            )
          })}
        </div>

        {paySpeeds ? (
          // One click target (v2.2022): the whole strip opens the per-customer
          // pay-speeds breakdown, with an explicit affordance at the right.
          <button
            type="button"
            onClick={() => setPaySpeedsOpen(true)}
            onMouseEnter={() => setPaySpeedsHover(true)}
            onMouseLeave={() => setPaySpeedsHover(false)}
            title="Open the pay-speeds breakdown — distribution chart and every customer's speed"
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '1.1rem',
              flexWrap: 'wrap',
              marginTop: '0.75rem',
              padding: '0.45rem 0.75rem',
              border: `1px solid ${paySpeedsHover ? 'var(--text-link)' : 'var(--border)'}`,
              borderRadius: 8,
              background: 'var(--surface)',
              width: '100%',
              font: 'inherit',
              color: 'inherit',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
              Pay speeds
            </span>
            {speedCell(
              <span style={{ color: 'var(--text-700)' }}>Company</span>,
              paySpeeds.company,
              'Median days from bill to payment across every customer, last 12 months',
            )}
            {speedCell(
              segmentTag('residential'),
              paySpeeds.segments.residential,
              'Median days from bill to payment across residential customers, last 12 months',
            )}
            {speedCell(
              segmentTag('commercial'),
              paySpeeds.segments.commercial,
              'Median days from bill to payment across commercial customers, last 12 months',
            )}
            <span
              style={{
                marginLeft: 'auto',
                alignSelf: 'center',
                color: 'var(--text-link)',
                fontSize: '0.72rem',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              See the breakdown <span aria-hidden>›</span>
            </span>
          </button>
        ) : null}
        {paySpeedsOpen ? (
          <PaySpeedsBreakdownModal
            rows={rows}
            paySpeeds={paySpeeds}
            todayYmd={todayYmd}
            onClose={() => setPaySpeedsOpen(false)}
            onOpenJobDetail={
              onOpenJobDetail
                ? (jobId) => {
                    setPaySpeedsOpen(false)
                    onOpenJobDetail(jobId)
                  }
                : undefined
            }
            canExcludePayments={canExcludePayments}
            isDev={isDev}
            canEmailMoneyWaiting={canEmailMoneyWaiting}
            onOpenJobStacked={onOpenJobStacked}
            onSpeedsChanged={onPaySpeedsChanged}
          />
        ) : null}

        {noticeSummary && noticeSummary.monthCount > 0 && noticeSummary.first ? (
          <div
            role="note"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0.35rem 0.6rem',
              marginTop: '0.6rem',
              padding: '0.4rem 0.75rem',
              borderRadius: 8,
              background: 'var(--bg-amber-tint)',
              color: 'var(--text-amber-800)',
              fontSize: '0.78rem',
            }}
          >
            <span aria-hidden>⏱</span>
            <strong>
              {noticeSummary.monthCount} work {noticeSummary.monthCount === 1 ? 'month' : 'months'} on {noticeSummary.jobCount} sub{' '}
              {noticeSummary.jobCount === 1 ? 'job has' : 'jobs have'} a lien notice closing within 14 days
            </strong>
            <span>· {formatUsdNoCents(noticeSummary.dollars)} open</span>
            <span>
              · {jobLabelById[noticeSummary.first.jobId] ?? noticeSummary.first.jobId} {workMonthLabel(noticeSummary.first.month.key)} work, notice{' '}
              {noticeStateText(noticeSummary.first.notice)}
            </span>
          </div>
        ) : null}

        {filteredTitle ? (
          <p style={{ margin: '0.75rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }} role="status">
            Showing only {filteredTitle} ·{' '}
            <button
              type="button"
              onClick={() => setBucketFilter(null)}
              style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-link)', fontSize: 'inherit' }}
            >
              Show all
            </button>
          </p>
        ) : null}

        {listedBuckets
          .map((b) => (
            <div key={b.key} style={{ marginTop: '1rem' }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)', borderBottom: '1px solid var(--border)', paddingBottom: '0.25rem' }}>
                {b.title} · {formatUsdNoCents(b.sum)}
              </div>
              {b.rows.map((r) => {
                const d = rowDateLabel(r)
                const wm = workMonths?.[r.jobId] ?? null
                const expanded = wm != null && openWorkMonths.has(r.jobId)
                return (
                  <div key={r.invoiceId}>
                    <div style={{ display: 'flex', alignItems: 'stretch', borderBottom: expanded ? 'none' : '1px solid var(--border)' }}>
                      {wm ? (
                        <button
                          type="button"
                          onClick={() => toggleWorkMonths(r.jobId)}
                          aria-expanded={expanded}
                          aria-label={`${expanded ? 'Hide' : 'Show'} work months for ${r.label}`}
                          title={expanded ? 'Hide the months worked' : `Show the months worked — ${wm.months.length} ${wm.months.length === 1 ? 'month' : 'months'}`}
                          style={{
                            width: 22,
                            flexShrink: 0,
                            alignSelf: 'center',
                            height: 18,
                            marginRight: 4,
                            border: '1px solid var(--border-strong)',
                            borderRadius: 5,
                            background: expanded ? 'var(--bg-blue-tint)' : 'var(--surface)',
                            color: expanded ? 'var(--text-blue-800)' : 'var(--text-muted)',
                            fontSize: '0.6rem',
                            cursor: 'pointer',
                            padding: 0,
                            transform: expanded ? 'rotate(90deg)' : 'none',
                          }}
                        >
                          ▶
                        </button>
                      ) : (
                        <span aria-hidden style={{ width: 26, flexShrink: 0 }} />
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenInvoice(r.invoiceId)}
                        title="Jump to this bill on the board"
                        style={{
                          display: 'flex',
                          width: '100%',
                          minWidth: 0,
                          alignItems: 'baseline',
                          justifyContent: 'space-between',
                          gap: '0.75rem',
                          padding: '0.4rem 0.25rem',
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: '0.8125rem',
                          color: 'inherit',
                        }}
                      >
                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.label}
                          {r.customerName ? <span style={{ color: 'var(--text-muted)' }}> · {r.customerName}</span> : null}
                          {r.segment ? <> {segmentTag(r.segment)}</> : null}
                          {r.model?.source === 'customer' ? (
                            <span style={{ color: 'var(--text-muted)' }}> · pays in ~{r.model.medianDays}d</span>
                          ) : r.model?.source === 'promised' ? (
                            <span style={{ color: 'var(--text-muted)' }}> · promised{r.slipDays ? ` · usually slips ~${r.slipDays}d` : ''}</span>
                          ) : r.model ? (
                            <span style={{ color: 'var(--text-muted)' }}> · company avg</span>
                          ) : null}
                          {wm ? (
                            <span style={{ color: 'var(--text-faint)', fontSize: '0.72rem' }}>
                              {' '}
                              · {wm.months.length} mo
                            </span>
                          ) : null}
                          <ForecastNoticeChip job={wm} />
                        </span>
                        <span style={{ display: 'inline-flex', gap: '0.6rem', alignItems: 'baseline', flexShrink: 0 }}>
                          <span style={{ color: d.color, fontWeight: 600 }}>{d.text}</span>
                          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{formatUsdNoCents(r.open)}</span>
                        </span>
                      </button>
                    </div>
                    {expanded && wm ? (
                      <ForecastWorkMonthsPanel
                        job={wm}
                        customerName={r.customerName}
                        isCommercial={r.segment === 'commercial'}
                        todayYmd={todayYmd}
                        onSendNotice={onOpenLienNotice}
                      />
                    ) : null}
                  </div>
                )
              })}
            </div>
          ))}

        <p style={{ margin: '0.9rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {forecast.rowCount} open {forecast.rowCount === 1 ? 'bill' : 'bills'} · {formatUsdNoCents(forecast.openTotal)} total
          {forecast.skippedNoMoney > 0 ? ` · ${forecast.skippedNoMoney} paid-to-zero ${forecast.skippedNoMoney === 1 ? 'row' : 'rows'} not shown` : ''}
          {paySpeeds == null ? ' · pay speeds unavailable — dates need the pay-speed lookup' : ''}
          {workMonths === null ? ' · loading the months worked…' : ''}
        </p>
      </div>
    </div>
  )
}
