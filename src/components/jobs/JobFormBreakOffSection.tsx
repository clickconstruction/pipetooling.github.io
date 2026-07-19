import { useBreakOffSlider } from './useBreakOffSlider'
import {
  formatCurrency,
  parseMoneyInputToNumber,
  parseMoneyInputToNumberOrNull,
  sanitizeMoneyTyping,
} from '../../lib/jobs/jobFormMoney'
import { breakDollarsFromCombinedPct, snapBreakOffCombinedPctToStep } from '../../lib/jobs/jobFormBreakOff'

type JobFormBreakOffSectionProps = {
  breakOff: ReturnType<typeof useBreakOffSlider>
  jobTotalBidDollars: number
  movingJobToReadyToBill: boolean
  creatingInvoice: boolean
  createInvoice: () => void
  moveWorkingJobToReadyToBillFromEdit: () => void
}

/**
 * The break-off / Ready-to-Bill control in the Edit-Job "Invoices" area: the
 * amount input (blur clamps to remaining then snaps to the 5% grid), the
 * create-invoice / move-to-RTB action button, the quick-set buttons, and the
 * pointer-driven combined progress slider (paid fill + break preview + 5% rails
 * + field-progress dot + keyboard thumb + legend). Extracted verbatim from
 * JobFormModal. The useBreakOffSlider hook and the two money-path action
 * handlers stay in the shell (the handlers read/write the hook's newInvoiceAmount
 * state); the whole hook object comes in as `breakOff`, the handlers + loading
 * flags as props.
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
    breakOffRemaining,
    breakOffCombinedSliderBounds,
    breakOffDraftCoveragePctDisplay,
    breakOffCombinedHandlePct,
    breakOffCombinedThumbLeftPct,
    applyBreakOffCombinedPct,
    onBillingBreakOffTrackPointerDown,
    onBillingBreakOffTrackPointerMove,
    onBillingBreakOffTrackPointerUpCancel,
    onBillingBreakOffTrackLostPointerCapture,
    onBreakOffSliderKeyDown,
  } = breakOff

  return (
                <div
                  style={{
                    marginBottom: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    width: '100%',
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                      width: '100%',
                      minWidth: 0,
                      rowGap: '0.35rem',
                    }}
                  >
                    <label
                      htmlFor="edit-job-partial-invoice-amount"
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        color: 'var(--text-700)',
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {isSendFullUnallocatedToReadyToBill ? 'Send to Ready to Bill:' : 'Break off Invoice:'}
                    </label>
                    <input
                      id="edit-job-partial-invoice-amount"
                      type="text"
                      inputMode="decimal"
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
                          const rawC = Math.min(100, ((breakOffPaidSum + clamped) / total) * 100)
                          const snappedC = snapBreakOffCombinedPctToStep(rawC, min, max)
                          clamped = breakDollarsFromCombinedPct(snappedC, total, breakOffPaidSum, rem)
                        }
                        setNewInvoiceAmount(String(clamped))
                      }}
                      onChange={(e) => setNewInvoiceAmount(sanitizeMoneyTyping(e.target.value))}
                      placeholder="$0"
                      title={
                        isSendFullUnallocatedToReadyToBill
                          ? 'Full unallocated amount: moves job to Ready to Bill (no separate draft line for this amount).'
                          : 'Break off an amount to send through Ready to Bill. Job stays in Working.'
                      }
                      style={{
                        minWidth: isSendFullUnallocatedToReadyToBill ? '9rem' : '6rem',
                        width: isSendFullUnallocatedToReadyToBill ? '9rem' : '6rem',
                        flexShrink: 0,
                        boxSizing: 'border-box',
                        padding: '0.375rem 0.5rem',
                        border: '1px solid var(--border-strong)',
                        borderRadius: 6,
                        fontSize: '0.875rem',
                        background: 'var(--surface)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={isSendFullUnallocatedToReadyToBill ? moveWorkingJobToReadyToBillFromEdit : createInvoice}
                      disabled={
                        movingJobToReadyToBill ||
                        creatingInvoice ||
                        !(parseMoneyInputToNumber(newInvoiceAmount) > 0)
                      }
                      title={isSendFullUnallocatedToReadyToBill ? 'Move job to Ready to Bill' : 'Create invoice'}
                      aria-label={isSendFullUnallocatedToReadyToBill ? 'Ready to Bill' : 'Create invoice'}
                      style={{
                        padding: isSendFullUnallocatedToReadyToBill ? '0.35rem 0.65rem' : '0.35rem 0.5rem',
                        fontSize: isSendFullUnallocatedToReadyToBill ? '0.8125rem' : '1rem',
                        fontWeight: 600,
                        lineHeight: 1,
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                        background:
                          movingJobToReadyToBill ||
                          creatingInvoice ||
                          !(parseMoneyInputToNumber(newInvoiceAmount) > 0)
                            ? '#9ca3af'
                            : '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: 6,
                        cursor:
                          movingJobToReadyToBill ||
                          creatingInvoice ||
                          !(parseMoneyInputToNumber(newInvoiceAmount) > 0)
                            ? 'not-allowed'
                            : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: isSendFullUnallocatedToReadyToBill ? '7.5rem' : '1.75rem',
                      }}
                    >
                      {movingJobToReadyToBill ? '…' : creatingInvoice ? '…' : isSendFullUnallocatedToReadyToBill ? 'Ready to Bill' : '+'}
                    </button>
                    {breakOffDraftCoveragePctDisplay != null && breakOffDraftCoveragePctDisplay < 100 ? (
                      <span
                        title="Payments plus this draft amount as a share of Job Total."
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          flexShrink: 0,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {breakOffDraftCoveragePctDisplay}% of job total
                      </span>
                    ) : null}
                  </div>
                  {breakOffBillingTrackPercents.hasTotal ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Quick set:</span>
                      {[
                        { pct: 20, label: '20%' },
                        { pct: 40, label: '40%' },
                        { pct: 60, label: '60%' },
                        { pct: 80, label: '80%' },
                        { pct: 100, label: 'Max' },
                      ].map((q) => (
                        <button
                          key={q.label}
                          type="button"
                          onClick={() => applyBreakOffCombinedPct(q.pct)}
                          title={q.label === 'Max' ? 'Break off everything left to bill' : `Paid + this bill = ${q.label} of Job Total`}
                          style={{
                            fontSize: '0.6875rem',
                            padding: '0.1rem 0.45rem',
                            borderRadius: 4,
                            border: '1px solid var(--border-strong)',
                            background: 'var(--surface)',
                            color: 'var(--text-700)',
                            cursor: 'pointer',
                            lineHeight: 1.4,
                          }}
                        >
                          {q.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {breakOffBillingTrackPercents.hasTotal ? (
                    <div style={{ width: '100%', minWidth: 0 }}>
                      <div
                        ref={billingBreakOffTrackRef}
                        style={{
                          position: 'relative',
                          width: '100%',
                          height: 34,
                          marginTop: 2,
                          touchAction: 'none',
                        }}
                        onPointerDown={onBillingBreakOffTrackPointerDown}
                        onPointerMove={onBillingBreakOffTrackPointerMove}
                        onPointerUp={onBillingBreakOffTrackPointerUpCancel}
                        onPointerCancel={onBillingBreakOffTrackPointerUpCancel}
                        onLostPointerCapture={onBillingBreakOffTrackLostPointerCapture}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            top: 8,
                            height: 8,
                            background: 'var(--bg-200)',
                            borderRadius: 4,
                            zIndex: 0,
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 8,
                            height: 8,
                            width: `${breakOffBillingTrackPercents.paidPct}%`,
                            background: '#2563eb',
                            borderRadius:
                              breakOffBillingTrackPercents.breakPreviewPct > 0 ? '4px 0 0 4px' : 4,
                            zIndex: 1,
                          }}
                        />
                        {breakOffBillingTrackPercents.breakPreviewPct > 0 ? (
                          <div
                            style={{
                              position: 'absolute',
                              left: `${breakOffBillingTrackPercents.paidPct}%`,
                              top: 8,
                              height: 8,
                              width: `${breakOffBillingTrackPercents.breakPreviewPct}%`,
                              background: '#93c5fd',
                              borderRadius: '0 4px 4px 0',
                              zIndex: 1,
                            }}
                          />
                        ) : null}
                        {Array.from({ length: 19 }, (_, i) => (i + 1) * 5).map((pct) => {
                          const isMajor = pct % 20 === 0
                          const railTop = 8
                          const railH = 8
                          const minorH = 5
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
                        <div
                          role="slider"
                          tabIndex={0}
                          aria-label={`Paid plus break-off through ${Math.round(breakOffCombinedHandlePct)}% of job total. Track shows ${Math.round(breakOffBillingTrackPercents.paidPct)}% paid and ${Math.round(breakOffBillingTrackPercents.breakPreviewPct)}% new invoice preview. ${jobCompleteTrackPct == null ? 'Field progress not set.' : `Field progress ${Math.round(jobCompleteTrackPct)}%.`}`}
                          aria-valuemin={Math.round(breakOffCombinedSliderBounds.min)}
                          aria-valuemax={Math.round(breakOffCombinedSliderBounds.max)}
                          aria-valuenow={Math.round(
                            Math.min(
                              breakOffCombinedSliderBounds.max,
                              Math.max(breakOffCombinedSliderBounds.min, breakOffCombinedHandlePct),
                            ),
                          )}
                          aria-orientation="horizontal"
                          data-breakoff-slider-thumb
                          onKeyDown={onBreakOffSliderKeyDown}
                          style={{
                            position: 'absolute',
                            left: `${breakOffCombinedThumbLeftPct}%`,
                            top: -2,
                            transform: 'translateX(-50%)',
                            zIndex: 5,
                            lineHeight: 0,
                            cursor: breakOffSliderDragCombinedPct != null ? 'grabbing' : 'grab',
                            padding: '6px 10px',
                            margin: '-6px -10px',
                            outline: 'none',
                          }}
                        >
                          <svg width="12" height="6" viewBox="0 0 12 6" aria-hidden>
                            <polygon
                              points="0,0 12,0 6,6"
                              fill="#22c55e"
                              stroke="#15803d"
                              strokeWidth="0.75"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            top: 20,
                            height: 14,
                          }}
                        >
                          {[20, 40, 60, 80].map((pct) => (
                            <span
                              key={`lbl-${pct}`}
                              style={{
                                position: 'absolute',
                                left: `${pct}%`,
                                transform: 'translateX(-50%)',
                                fontSize: '0.65rem',
                                color: 'var(--text-muted)',
                                lineHeight: 1.2,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {pct}%
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      Add Specific Work lines to set Job Total for this chart.
                    </div>
                  )}
                  {breakOffBillingTrackPercents.hasTotal ? (
                    <div
                      role="group"
                      aria-label="Billing progress bar legend"
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.65rem 1rem',
                        rowGap: '0.35rem',
                        width: '100%',
                        minWidth: 0,
                        marginTop: 2,
                      }}
                    >
                      {(
                        [
                          { color: 'var(--text-link)', label: 'Paid', sub: '', circle: false },
                          { color: '#93c5fd', label: 'New Invoice', sub: '', circle: false },
                          {
                            color: '#facc15',
                            label:
                              jobCompleteTrackPct == null ? 'Job: Not set' : `Job: ${Math.round(jobCompleteTrackPct)}%`,
                            sub: '',
                            circle: true,
                          },
                        ] as {
                          color: string
                          label: string
                          sub: string
                          circle: boolean
                        }[]
                      ).map((item) => (
                        <div
                          key={item.label}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'flex-start',
                            gap: 6,
                            maxWidth: '100%',
                          }}
                        >
                          <span
                            aria-hidden
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: item.circle ? '50%' : 3,
                              background: item.color,
                              border: item.circle ? '1px solid #ca8a04' : 'none',
                              boxSizing: 'border-box',
                              flexShrink: 0,
                              marginTop: 2,
                            }}
                          />
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.35, minWidth: 0 }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-600)' }}>{item.label}</span>
                            {item.sub ? (
                              <>
                                {' — '}
                                {item.sub}
                              </>
                            ) : null}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
  )
}
