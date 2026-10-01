import { useBreakOffSlider } from './useBreakOffSlider'
import { BILLED_COLOR, DRAFT_COLOR, PAID_COLOR } from './MoneyLifecycleBar'
import { parseMoneyInputToNumber } from '../../lib/jobs/jobFormMoney'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'

/**
 * The draggable break-off track — since v2.4307 inside Make a bill's "Bill part of it"
 * (`JobFormMakeABill`), under the amount box. Money coalesces left in
 * lifecycle order (paid → billed → new invoice preview → left); the handle
 * carries a live "$ · %" badge; the yellow field-progress marker keeps its dot
 * plus a labeled caret below the track. A quiet note appears when the bill
 * would run well ahead of field progress — informative, never blocking
 * (deposits and rough-in draws are legitimate). Shares the shell's single
 * useBreakOffSlider instance with the equation row, so the amount input,
 * handle, and badges stay in lockstep.
 */
export function JobFormBreakOffTrack({
  breakOff,
  billsAheadRemedyHint,
}: {
  breakOff: ReturnType<typeof useBreakOffSlider>
  /** Remedy line appended to the bills-ahead warning when an unpaid billed row could be sent back instead (v2.1653). */
  billsAheadRemedyHint?: string | null
}) {
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
              {billsAheadRemedyHint ? <> {billsAheadRemedyHint}</> : null}
            </p>
          ) : null}
        </div>
  )
}
