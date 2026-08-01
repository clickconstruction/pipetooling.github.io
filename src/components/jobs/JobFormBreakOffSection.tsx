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
  pct,
  children,
  highlighted,
  title,
}: {
  dot: string
  dotCircle?: boolean
  label: string
  /** Share of the job total shown after the label, mirroring the pill's % (v2.1141). */
  pct?: number | null
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
        {pct != null ? <span style={{ fontWeight: 400 }}>{pct}% </span> : null}
        {label}
      </span>
      <span style={{ fontSize: '0.8125rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textAlign: 'center' }}>
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
 * the quick-set percents always visible). The draggable track whose money
 * coalesces left in lifecycle order (paid → billed → new invoice → left) is
 * `JobFormBreakOffTrack` below — the shell renders it separately via the
 * segment bar's `trackSlot` (between the ② strip and its segment rows),
 * sharing the same `useBreakOffSlider` state.
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
    isSendFullUnallocatedToReadyToBill,
    breakOffBillingTrackPercents,
    breakOffPaidSum,
    breakOffBilledSum,
    breakOffRemaining,
    breakOffCombinedSliderBounds,
    breakOffInvoiceSharePct,
  } = breakOff

  const invoiceDollars = parseMoneyInputToNumber(newInvoiceAmount)
  const actionDisabled = movingJobToReadyToBill || creatingInvoice || !(invoiceDollars > 0)
  const leftAfterDollars = Math.max(0, Math.round((breakOffRemaining - Math.max(0, invoiceDollars)) * 100) / 100)
  const { paidPct, billedPct } = breakOffBillingTrackPercents.hasTotal
    ? breakOffBillingTrackPercents
    : { paidPct: 0, billedPct: 0 }

  return (
    <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', minWidth: 0 }}>
      {/* The equation row: chips ARE the math, the legend, the input, and the action. */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem', rowGap: '0.45rem', width: '100%', minWidth: 0 }}>
        <EquationChip
          dot={PAID_COLOR}
          label="Paid"
          pct={breakOffBillingTrackPercents.hasTotal ? Math.round(paidPct) : null}
          title="Payments received on the job"
        >
          {formatUsdNoCents(breakOffPaidSum)}
        </EquationChip>
        <span aria-hidden style={{ color: 'var(--text-faint)', fontSize: '0.8125rem' }}>+</span>
        <EquationChip
          dot={BILLED_COLOR}
          label="Billed"
          pct={breakOffBillingTrackPercents.hasTotal ? Math.round(billedPct) : null}
          title="Invoices already carved off (drafts and sent bills)"
        >
          {formatUsdNoCents(breakOffBilledSum)}
        </EquationChip>
        <span aria-hidden style={{ color: 'var(--text-faint)', fontSize: '0.8125rem' }}>+</span>
        {/* Two-level pill (v2.1139): the action button sits in the label slot —
            dot + Make new Invoice / Ready to Bill + share % on top, the amount
            input below — so the chip matches its siblings' label-over-value shape. */}
        <span
          title={
            isSendFullUnallocatedToReadyToBill
              ? 'Full unallocated amount: moves job to Ready to Bill (no separate draft line for this amount).'
              : 'Break off an amount to send through Ready to Bill. Job stays in Working.'
          }
          style={{
            display: 'inline-flex',
            flexDirection: 'column',
            gap: 2,
            background: 'var(--surface)',
            border: '2px solid #3b82f6',
            borderRadius: 8,
            padding: '0.3rem 0.6rem',
            minWidth: 0,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}>
            <span
              aria-hidden
              style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 2, background: DRAFT_COLOR, flexShrink: 0 }}
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
              aria-label={isSendFullUnallocatedToReadyToBill ? 'Ready to Bill' : 'New invoice'}
              style={{
                padding: '0.25rem 0.6rem',
                fontSize: '0.75rem',
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
              {movingJobToReadyToBill || creatingInvoice ? '…' : isSendFullUnallocatedToReadyToBill ? 'Ready to Bill' : 'New Invoice'}
            </button>

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
                width: '7.5rem',
                boxSizing: 'border-box',
                padding: '0.1rem 0.1rem',
                border: 'none',
                borderBottom: '1px solid var(--border-strong)',
                borderRadius: 0,
                fontSize: '0.8125rem',
                fontWeight: 600,
                background: 'transparent',
                fontVariantNumeric: 'tabular-nums',
                textAlign: 'center',
              }}
            />
        </span>
        <span aria-hidden style={{ color: 'var(--text-faint)', fontSize: '0.8125rem' }}>→</span>
        <EquationChip
          dot="var(--border)"
          label="Left to bill"
          pct={
            breakOffBillingTrackPercents.hasTotal && jobTotalBidDollars > 0
              ? Math.round(Math.min(100, Math.max(0, (leftAfterDollars / jobTotalBidDollars) * 100)))
              : null
          }
          title="Unallocated after this bill: job total minus payments minus every invoice, including this one"
        >
          {formatUsdNoCents(leftAfterDollars)}
        </EquationChip>
      </div>

    </div>
  )
}

/**
 * The draggable break-off track — rendered inside the ② segment bar's
 * `trackSlot`, between the strip and its per-segment rows, separately from
 * the equation row. Money coalesces left in
 * lifecycle order (paid → billed → new invoice preview → left); the handle
 * carries a live "$ · %" badge; the yellow field-progress marker keeps its dot
 * plus a labeled caret below the track. A quiet note appears when the bill
 * would run well ahead of field progress — informative, never blocking
 * (deposits and rough-in draws are legitimate). Shares the shell's single
 * useBreakOffSlider instance with the equation row, so the amount input,
 * handle, and badges stay in lockstep.
 */
export function JobFormBreakOffTrack({ breakOff }: { breakOff: ReturnType<typeof useBreakOffSlider> }) {
  const {
    newInvoiceAmount,
    breakOffSliderDragCombinedPct,
    billingBreakOffTrackRef,
    breakOffBillingTrackPercents,
    jobCompleteTrackPct,
    breakOffRemaining,
    breakOffCombinedSliderBounds,
    breakOffInvoiceSharePct,
    breakOffCombinedHandlePct,
    breakOffCombinedThumbLeftPct,
    onBillingBreakOffTrackPointerDown,
    onBillingBreakOffTrackPointerMove,
    onBillingBreakOffTrackPointerUpCancel,
    onBillingBreakOffTrackLostPointerCapture,
    onBreakOffSliderKeyDown,
  } = breakOff

  if (!breakOffBillingTrackPercents.hasTotal) return null
  const { paidPct, breakPreviewPct, billedPct } = breakOffBillingTrackPercents
  const previewStartPct = Math.min(100, paidPct + billedPct)
  const invoiceDollars = parseMoneyInputToNumber(newInvoiceAmount)
  // Quiet heads-up when the bill runs well ahead of the field (>10 points).
  const billsAheadOfField =
    jobCompleteTrackPct != null &&
    invoiceDollars > 0 &&
    breakOffCombinedHandlePct > jobCompleteTrackPct + 10
  // Reserve under-track height only for rows that can actually appear
  // (v2.1230): the fixed 60px assumed both the handle badge AND the yellow
  // field-progress caret; jobs with no field progress rendered the caret row
  // as dead white space above the segment list. The badge reservation keys on
  // the thumb's existence (breakOffRemaining), NOT on invoiceDollars — the
  // badge pops in mid-drag and the track must not change height under the
  // user's finger.
  const trackHeight = jobCompleteTrackPct != null ? 60 : breakOffRemaining > 0 ? 44 : 24

  return (
        <div style={{ width: '100%', minWidth: 0, marginTop: '0.5rem' }}>
          <div
            ref={billingBreakOffTrackRef}
            style={{ position: 'relative', width: '100%', height: trackHeight, marginTop: 2, touchAction: 'none' }}
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
                  // Above the pinch thumb (z 5): when the field dot and the
                  // thumb coincide, the full circle sits centered between the
                  // arrowheads instead of peeking through their 4px sliver as
                  // a clipped diamond.
                  zIndex: 6,
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
                  // Symmetric padding enlarges the grab target; no negative margin —
                  // on an absolutely-positioned box it shifted the whole thumb left
                  // of translateX(-50%), parking the apex ~10px off the boundary
                  // (the triangle's RIGHT edge read as the pointer). v2.1141: the
                  // apex now sits exactly on the edge it controls.
                  padding: '6px 10px',
                  outline: 'none',
                }}
              >
                <svg width="12" height="20" viewBox="0 0 12 20" aria-hidden>
                  {/* ▼ above and ▲ below pinch the boundary symmetrically (v2.1144):
                      each tip penetrates the 12px rail by 4px, leaving a 4px
                      sliver of rail visible between them. */}
                  <polygon points="0,0 12,0 6,8" fill="#22c55e" stroke="#15803d" strokeWidth="0.75" strokeLinejoin="round" />
                  <polygon points="0,20 12,20 6,12" fill="#22c55e" stroke="#15803d" strokeWidth="0.75" strokeLinejoin="round" />
                </svg>
              </div>
            ) : null}
            {/* Under-track row: the handle's live badge and the field-progress caret
                (the $0/total axis anchors moved up to the legend row). */}
            <div style={{ position: 'absolute', left: 0, right: 0, top: 24, height: 34, pointerEvents: 'none' }}>
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
                  {breakOffInvoiceSharePct != null ? `${breakOffInvoiceSharePct}% · ` : ''}
                  {formatUsdNoCents(invoiceDollars)}
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
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#facc15',
                      border: '1px solid #ca8a04',
                      boxSizing: 'border-box',
                      verticalAlign: '-1px',
                      marginRight: 3,
                    }}
                  />
                  Job {Math.round(jobCompleteTrackPct)}% done
                </span>
              ) : null}
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
                display: 'table',
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            >
              ⚠ Would bill through {Math.round(breakOffCombinedHandlePct)}% of a job that&rsquo;s{' '}
              {Math.round(jobCompleteTrackPct ?? 0)}% done in the field.
            </p>
          ) : null}
        </div>
  )
}
