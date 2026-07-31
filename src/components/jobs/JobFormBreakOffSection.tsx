import { useEffect, useState } from 'react'
import { useBreakOffSlider } from './useBreakOffSlider'
import { BILLED_COLOR, DRAFT_COLOR, PAID_COLOR } from './MoneyLifecycleBar'
import {
  formatCurrency,
  parseMoneyInputToNumber,
  parseMoneyInputToNumberOrNull,
  sanitizeMoneyTyping,
} from '../../lib/jobs/jobFormMoney'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { breakDollarsFromCombinedPct, snapBreakOffCombinedPctToStep } from '../../lib/jobs/jobFormBreakOff'

type JobFormBreakOffSectionProps = {
  breakOff: ReturnType<typeof useBreakOffSlider>
  jobTotalBidDollars: number
  movingJobToReadyToBill: boolean
  creatingInvoice: boolean
  createInvoice: () => void
  moveWorkingJobToReadyToBillFromEdit: () => void
}

/** Equation chip: color dot + label over an amount — the row doubles as the legend (v2.1137). */
function EquationChip({
  dot,
  dotCircle,
  label,
  children,
  highlighted,
  title,
}: {
  dot: string
  dotCircle?: boolean
  label: string
  children: React.ReactNode
  highlighted?: boolean
  title?: string
}) {
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        gap: 2,
        background: highlighted ? 'var(--surface)' : 'var(--bg-subtle)',
        border: highlighted ? '2px solid #3b82f6' : '1px solid var(--border)',
        borderRadius: 8,
        padding: '0.3rem 0.6rem',
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: '0.6875rem', color: highlighted ? 'var(--text-blue-700)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: 7,
            height: 7,
            borderRadius: dotCircle ? '50%' : 2,
            background: dot,
            marginRight: 4,
            verticalAlign: 'baseline',
          }}
        />
        {label}
      </span>
      <span style={{ fontSize: '0.8125rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {children}
      </span>
    </span>
  )
}

/**
 * The break-off / Ready-to-Bill control in the Edit-Job "Invoices" area,
 * reworked v2.1137 into the equation + labeled-track hybrid: a chip row that IS
 * the math and the legend (Paid + Billed + New invoice → Left to bill, with the
 * amount input and the create/RTB action living inside the New invoice chip and
 * the quick-set percents always visible), over a draggable track whose money
 * coalesces left in lifecycle order (paid → billed → new invoice → left). The
 * handle carries a live "$ · %" badge; the yellow field-progress marker keeps
 * its dot plus a labeled caret below the track (no legend row anymore). A quiet
 * note appears when the bill would run well ahead of field progress — informative,
 * never blocking (deposits and rough-in draws are legitimate).
 * Slider math stays in useBreakOffSlider; the combined axis base is paid+billed.
 */
export function JobFormBreakOffSection({
  breakOff,
  jobTotalBidDollars,
  movingJobToReadyToBill,
  creatingInvoice,
  createInvoice,
  moveWorkingJobToReadyToBillFromEdit,
}: JobFormBreakOffSectionProps) {
  const {
    newInvoiceAmount,
    setNewInvoiceAmount,
    newInvoiceAmountInputFocused,
    setNewInvoiceAmountInputFocused,
    breakOffSliderDragCombinedPct,
    billingBreakOffTrackRef,
    isSendFullUnallocatedToReadyToBill,
    breakOffBillingTrackPercents,
    jobCompleteTrackPct,
    breakOffPaidSum,
    breakOffBilledSum,
    breakOffRemaining,
    breakOffCombinedSliderBounds,
    breakOffInvoiceSharePct,
    breakOffCombinedHandlePct,
    breakOffCombinedThumbLeftPct,
    applyBreakOffCombinedPct,
    onBillingBreakOffTrackPointerDown,
    onBillingBreakOffTrackPointerMove,
    onBillingBreakOffTrackPointerUpCancel,
    onBillingBreakOffTrackLostPointerCapture,
    onBreakOffSliderKeyDown,
  } = breakOff

  const [infoOpen, setInfoOpen] = useState(false)
  useEffect(() => {
    if (!infoOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInfoOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [infoOpen])

  const invoiceDollars = parseMoneyInputToNumber(newInvoiceAmount)
  const actionDisabled = movingJobToReadyToBill || creatingInvoice || !(invoiceDollars > 0)
  const leftAfterDollars = Math.max(0, Math.round((breakOffRemaining - Math.max(0, invoiceDollars)) * 100) / 100)
  const { paidPct, breakPreviewPct, billedPct } = breakOffBillingTrackPercents.hasTotal
    ? breakOffBillingTrackPercents
    : { paidPct: 0, breakPreviewPct: 0, billedPct: 0 }
  const previewStartPct = Math.min(100, paidPct + billedPct)
  // Quiet heads-up when the bill runs well ahead of the field (>10 points).
  const billsAheadOfField =
    jobCompleteTrackPct != null &&
    invoiceDollars > 0 &&
    breakOffCombinedHandlePct > jobCompleteTrackPct + 10

  return (
    <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', minWidth: 0 }}>
      {/* The equation row: chips ARE the math, the legend, the input, and the action. */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem', rowGap: '0.45rem', width: '100%', minWidth: 0 }}>
        <EquationChip dot={PAID_COLOR} label="Paid" title="Payments received on the job">
          {formatUsdNoCents(breakOffPaidSum)}
        </EquationChip>
        <span aria-hidden style={{ color: 'var(--text-faint)', fontSize: '0.8125rem' }}>+</span>
        <EquationChip dot={BILLED_COLOR} label="Billed" title="Invoices already carved off (drafts and sent bills)">
          {formatUsdNoCents(breakOffBilledSum)}
        </EquationChip>
        <span aria-hidden style={{ color: 'var(--text-faint)', fontSize: '0.8125rem' }}>+</span>
        {/* Single-line pill (v2.1138): the label sits inline with the input and the
            action so the chip stays one row tall — "full remainder" mode is carried
            by the blue Ready to Bill button and the tooltip, not label width. */}
        <span
          title={
            isSendFullUnallocatedToReadyToBill
              ? 'Full unallocated amount: moves job to Ready to Bill (no separate draft line for this amount).'
              : 'Break off an amount to send through Ready to Bill. Job stays in Working.'
          }
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'var(--surface)',
            border: '2px solid #3b82f6',
            borderRadius: 999,
            padding: '0.25rem 0.65rem',
            minWidth: 0,
          }}
        >
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-blue-700)', whiteSpace: 'nowrap' }}>
            <span
              aria-hidden
              style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 2, background: DRAFT_COLOR, marginRight: 4, verticalAlign: 'baseline' }}
            />
            New invoice
          </span>
            <input
              id="edit-job-partial-invoice-amount"
              type="text"
              inputMode="decimal"
              aria-label={isSendFullUnallocatedToReadyToBill ? 'Send to Ready to Bill amount' : 'New invoice amount'}
              value={
                newInvoiceAmountInputFocused
                  ? newInvoiceAmount
                  : newInvoiceAmount.trim() === ''
                    ? ''
                    : formatCurrency(parseMoneyInputToNumber(newInvoiceAmount))
              }
              onFocus={() => setNewInvoiceAmountInputFocused(true)}
              onBlur={() => {
                setNewInvoiceAmountInputFocused(false)
                const n = parseMoneyInputToNumberOrNull(newInvoiceAmount)
                if (n == null) {
                  setNewInvoiceAmount('')
                  return
                }
                const rem = breakOffRemaining
                const useCents = Math.min(Math.round(n * 100), Math.round(rem * 100))
                let clamped = useCents / 100
                const total = jobTotalBidDollars
                if (total > 0) {
                  const { min, max } = breakOffCombinedSliderBounds
                  const base = breakOffPaidSum + breakOffBilledSum
                  const rawC = Math.min(100, ((base + clamped) / total) * 100)
                  const snappedC = snapBreakOffCombinedPctToStep(rawC, min, max)
                  clamped = breakDollarsFromCombinedPct(snappedC, total, base, rem)
                }
                setNewInvoiceAmount(String(clamped))
              }}
              onChange={(e) => setNewInvoiceAmount(sanitizeMoneyTyping(e.target.value))}
              placeholder="$0"
              style={{
                width: '6rem',
                boxSizing: 'border-box',
                padding: '0.1rem 0.1rem',
                border: 'none',
                borderBottom: '1px solid var(--border-strong)',
                borderRadius: 0,
                fontSize: '0.8125rem',
                fontWeight: 600,
                background: 'transparent',
                fontVariantNumeric: 'tabular-nums',
              }}
            />
            {breakOffInvoiceSharePct != null ? (
              <span style={{ fontSize: '0.6875rem', fontWeight: 400, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {breakOffInvoiceSharePct}%
              </span>
            ) : null}
            <button
              type="button"
              onClick={isSendFullUnallocatedToReadyToBill ? moveWorkingJobToReadyToBillFromEdit : createInvoice}
              disabled={actionDisabled}
              title={isSendFullUnallocatedToReadyToBill ? 'Move job to Ready to Bill' : 'Create invoice'}
              aria-label={isSendFullUnallocatedToReadyToBill ? 'Ready to Bill' : 'Create invoice'}
              style={{
                padding: isSendFullUnallocatedToReadyToBill ? '0.25rem 0.6rem' : '0.2rem 0.45rem',
                fontSize: isSendFullUnallocatedToReadyToBill ? '0.75rem' : '0.9375rem',
                fontWeight: 600,
                lineHeight: 1,
                flexShrink: 0,
                whiteSpace: 'nowrap',
                // Green = invoice action, blue = job move — same color language as Stages.
                background: actionDisabled ? '#9ca3af' : isSendFullUnallocatedToReadyToBill ? '#3b82f6' : '#16a34a',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: actionDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              {movingJobToReadyToBill || creatingInvoice ? '…' : isSendFullUnallocatedToReadyToBill ? 'Ready to Bill' : '+'}
            </button>
        </span>
        <span aria-hidden style={{ color: 'var(--text-faint)', fontSize: '0.8125rem' }}>→</span>
        <EquationChip dot="var(--border)" label="Left to bill" title="Unallocated after this bill: job total minus payments minus every invoice, including this one">
          {formatUsdNoCents(leftAfterDollars)}
        </EquationChip>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginLeft: 'auto', flexWrap: 'wrap' }}>
          {breakOffBillingTrackPercents.hasTotal && breakOffRemaining > 0
            ? [
                { pct: 20, label: '20%' },
                { pct: 40, label: '40%' },
                { pct: 60, label: '60%' },
                { pct: 80, label: '80%' },
                { pct: 100, label: 'Max' },
              ]
                // Numeric targets only when they land strictly inside the slider's
                // travel (below/at min = $0 invoice; at/above max = same as Max).
                .filter((q) =>
                  q.pct === 100
                    ? true
                    : q.pct > breakOffCombinedSliderBounds.min && q.pct < breakOffCombinedSliderBounds.max,
                )
                .map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => applyBreakOffCombinedPct(q.pct)}
                    title={
                      q.label === 'Max'
                        ? 'Break off everything left to bill'
                        : `Paid + billed + this bill = ${q.label} of Job Total`
                    }
                    style={{
                      fontSize: '0.6875rem',
                      padding: '0.15rem 0.5rem',
                      borderRadius: 999,
                      border: '1px solid var(--border-strong)',
                      background: 'var(--surface)',
                      color: 'var(--text-700)',
                      cursor: 'pointer',
                      lineHeight: 1.4,
                      fontWeight: q.label === 'Max' ? 600 : 400,
                    }}
                  >
                    {q.label}
                  </button>
                ))
            : null}
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            aria-label="How the invoice slider works"
            title="How the invoice slider works"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 18,
              height: 18,
              flexShrink: 0,
              borderRadius: '50%',
              border: '1px solid var(--border-strong)',
              background: 'var(--surface)',
              color: 'var(--text-muted)',
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontStyle: 'italic',
              fontWeight: 700,
              fontSize: '0.7rem',
              lineHeight: 1,
              padding: 0,
              cursor: 'pointer',
            }}
          >
            i
          </button>
        </span>
      </div>

      {breakOffBillingTrackPercents.hasTotal ? (
        <div style={{ width: '100%', minWidth: 0 }}>
          <div
            ref={billingBreakOffTrackRef}
            style={{ position: 'relative', width: '100%', height: 58, marginTop: 2, touchAction: 'none' }}
            onPointerDown={onBillingBreakOffTrackPointerDown}
            onPointerMove={onBillingBreakOffTrackPointerMove}
            onPointerUp={onBillingBreakOffTrackPointerUpCancel}
            onPointerCancel={onBillingBreakOffTrackPointerUpCancel}
            onLostPointerCapture={onBillingBreakOffTrackLostPointerCapture}
          >
            {/* Rail — money coalesces left: paid, billed, the new invoice, then what's left. */}
            <div style={{ position: 'absolute', left: 0, right: 0, top: 6, height: 12, background: 'var(--bg-200)', borderRadius: 5, zIndex: 0 }} />
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 6,
                height: 12,
                width: `${paidPct}%`,
                background: PAID_COLOR,
                borderRadius: billedPct > 0 || breakPreviewPct > 0 ? '5px 0 0 5px' : 5,
                zIndex: 1,
              }}
            />
            {billedPct > 0 ? (
              <div
                style={{
                  position: 'absolute',
                  left: `${paidPct}%`,
                  top: 6,
                  height: 12,
                  width: `${billedPct}%`,
                  background: BILLED_COLOR,
                  borderRadius: paidPct <= 0 ? (breakPreviewPct > 0 ? '5px 0 0 5px' : 5) : breakPreviewPct > 0 ? 0 : '0 5px 5px 0',
                  zIndex: 1,
                }}
              />
            ) : null}
            {breakPreviewPct > 0 ? (
              <div
                style={{
                  position: 'absolute',
                  left: `${previewStartPct}%`,
                  top: 6,
                  height: 12,
                  width: `${breakPreviewPct}%`,
                  background: DRAFT_COLOR,
                  borderRadius: previewStartPct <= 0 ? '5px 0 0 5px' : '0 5px 5px 0',
                  zIndex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {breakPreviewPct >= 14 ? (
                  <span
                    aria-hidden
                    style={{ fontSize: '0.625rem', fontWeight: 600, color: '#0C447C', whiteSpace: 'nowrap', pointerEvents: 'none' }}
                  >
                    {formatUsdNoCents(invoiceDollars)}
                  </span>
                ) : null}
              </div>
            ) : null}
            {/* 5% snap rails (major every 20%). */}
            {Array.from({ length: 19 }, (_, i) => (i + 1) * 5).map((pct) => {
              const isMajor = pct % 20 === 0
              const railTop = 6
              const railH = 12
              const minorH = 7
              const h = isMajor ? railH : minorH
              const top = isMajor ? railTop : railTop + (railH - minorH) / 2
              return (
                <div
                  key={pct}
                  style={{
                    position: 'absolute',
                    left: `${pct}%`,
                    top,
                    transform: 'translateX(-50%)',
                    width: 1,
                    height: h,
                    background: 'var(--surface)',
                    borderRadius: 1,
                    zIndex: 2,
                    pointerEvents: 'none',
                    boxShadow: '0 0 0 0.5px rgba(0, 0, 0, 0.12)',
                    opacity: isMajor ? 1 : 0.85,
                  }}
                />
              )
            })}
            {/* Field-progress dot on the rail; its labeled caret sits below the track. */}
            {jobCompleteTrackPct != null ? (
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  left: `${jobCompleteTrackPct}%`,
                  top: 7,
                  width: 10,
                  height: 10,
                  transform: 'translateX(-50%)',
                  borderRadius: '50%',
                  background: '#facc15',
                  border: '1px solid #ca8a04',
                  boxSizing: 'border-box',
                  zIndex: 3,
                  pointerEvents: 'none',
                }}
              />
            ) : null}
            {breakOffRemaining > 0 ? (
              <div
                role="slider"
                tabIndex={0}
                aria-label={`Allocated through ${Math.round(breakOffCombinedHandlePct)}% of job total. Track shows ${Math.round(paidPct)}% paid, then ${Math.round(billedPct)}% already billed, then ${Math.round(breakPreviewPct)}% new invoice preview. ${jobCompleteTrackPct == null ? 'Field progress not set.' : `Field progress ${Math.round(jobCompleteTrackPct)}%.`}`}
                aria-valuemin={Math.round(breakOffCombinedSliderBounds.min)}
                aria-valuemax={Math.round(breakOffCombinedSliderBounds.max)}
                aria-valuenow={Math.round(
                  Math.min(breakOffCombinedSliderBounds.max, Math.max(breakOffCombinedSliderBounds.min, breakOffCombinedHandlePct)),
                )}
                aria-orientation="horizontal"
                data-breakoff-slider-thumb
                onKeyDown={onBreakOffSliderKeyDown}
                style={{
                  position: 'absolute',
                  left: `${breakOffCombinedThumbLeftPct}%`,
                  top: -4,
                  transform: 'translateX(-50%)',
                  zIndex: 5,
                  lineHeight: 0,
                  cursor: breakOffSliderDragCombinedPct != null ? 'grabbing' : 'grab',
                  padding: '6px 10px',
                  margin: '-6px -10px',
                  outline: 'none',
                }}
              >
                <svg width="12" height="8" viewBox="0 0 12 8" aria-hidden>
                  <polygon points="0,0 12,0 6,8" fill="#22c55e" stroke="#15803d" strokeWidth="0.75" strokeLinejoin="round" />
                </svg>
              </div>
            ) : null}
            {/* Under-track row: the handle's live badge, the field-progress caret, and the $0/total anchors. */}
            <div style={{ position: 'absolute', left: 0, right: 0, top: 22, height: 34, pointerEvents: 'none' }}>
              {breakOffRemaining > 0 && invoiceDollars > 0 ? (
                <span
                  style={{
                    position: 'absolute',
                    left: `${breakOffCombinedThumbLeftPct}%`,
                    transform: 'translateX(-50%)',
                    top: 2,
                    fontSize: '0.625rem',
                    fontWeight: 600,
                    background: '#185FA5',
                    color: '#ffffff',
                    borderRadius: 4,
                    padding: '1px 6px',
                    whiteSpace: 'nowrap',
                    fontVariantNumeric: 'tabular-nums',
                    zIndex: 2,
                    // Keep the badge on-canvas near the edges.
                    ...(breakOffCombinedThumbLeftPct < 8 ? { left: 0, transform: 'none' } : {}),
                    ...(breakOffCombinedThumbLeftPct > 92 ? { left: 'auto', right: 0, transform: 'none' } : {}),
                  }}
                >
                  {formatUsdNoCents(invoiceDollars)}
                  {breakOffInvoiceSharePct != null ? ` · ${breakOffInvoiceSharePct}%` : ''}
                </span>
              ) : null}
              {jobCompleteTrackPct != null ? (
                <span
                  style={{
                    position: 'absolute',
                    left: `${jobCompleteTrackPct}%`,
                    transform: 'translateX(-50%)',
                    top: 18,
                    fontSize: '0.625rem',
                    color: 'var(--text-amber-700)',
                    whiteSpace: 'nowrap',
                    zIndex: 1,
                    ...(jobCompleteTrackPct < 8 ? { left: 0, transform: 'none' } : {}),
                    ...(jobCompleteTrackPct > 92 ? { left: 'auto', right: 0, transform: 'none' } : {}),
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      display: 'inline-block',
                      width: 0,
                      height: 0,
                      borderLeft: '4px solid transparent',
                      borderRight: '4px solid transparent',
                      borderBottom: '6px solid #facc15',
                      verticalAlign: '1px',
                      marginRight: 3,
                    }}
                  />
                  Job {Math.round(jobCompleteTrackPct)}% done
                </span>
              ) : null}
              {(jobCompleteTrackPct == null || jobCompleteTrackPct > 12) && (
                <span style={{ position: 'absolute', left: 0, top: 18, fontSize: '0.625rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  $0
                </span>
              )}
              {(jobCompleteTrackPct == null || jobCompleteTrackPct < 88) && (
                <span style={{ position: 'absolute', right: 0, top: 18, fontSize: '0.625rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatUsdNoCents(jobTotalBidDollars)}
                </span>
              )}
            </div>
          </div>
          {billsAheadOfField ? (
            <p
              style={{
                margin: '0.15rem 0 0',
                fontSize: '0.75rem',
                color: 'var(--text-amber-800)',
                background: 'var(--bg-amber-tint)',
                border: '1px solid #f59e0b',
                borderRadius: 6,
                padding: '0.3rem 0.6rem',
                display: 'inline-block',
              }}
            >
              ⚠ Would bill through {Math.round(breakOffCombinedHandlePct)}% of a job that&rsquo;s{' '}
              {Math.round(jobCompleteTrackPct ?? 0)}% done in the field — fine for deposits and draws, just so you know.
            </p>
          ) : null}
        </div>
      ) : null}

      {infoOpen ? (
        <div
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setInfoOpen(false)
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '1rem',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="break-off-info-title"
            style={{
              background: 'var(--surface)',
              padding: '1.25rem 1.5rem',
              borderRadius: 8,
              width: '100%',
              maxWidth: 420,
              boxSizing: 'border-box',
              boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="break-off-info-title"
              style={{ margin: '0 0 0.75rem', fontSize: '1.0625rem', fontWeight: 600, color: 'var(--text-800)' }}
            >
              How the invoice slider works
            </h2>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.875rem', lineHeight: 1.5, color: 'var(--text-700)' }}>
              Money that&rsquo;s already spoken for — paid, then billed — fills the bar from the left. The green
              triangle sets the next bill: it grows from where allocation ends and can&rsquo;t pass what&rsquo;s left to
              bill (job total minus payments minus invoices already carved off). Type an amount, tap a percent, or
              drag — they all move together. The yellow marker is just how far along the work is; it never limits
              the bill.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setInfoOpen(false)}
                style={{
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
