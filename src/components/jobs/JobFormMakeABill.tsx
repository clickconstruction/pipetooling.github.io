import { useRef, useState } from 'react'
import type { useBreakOffSlider } from './useBreakOffSlider'
import { JobFormBreakOffTrack } from './JobFormBreakOffSection'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { useToastContext } from '../../contexts/ToastContext'
import { formatCurrency, parseMoneyInputToNumber, parseMoneyInputToNumberOrNull, sanitizeMoneyTyping } from '../../lib/jobs/jobFormMoney'
import {
  breakDollarsFromCombinedPct,
  breakOffButtonAction,
  breakOffButtonChangedWords,
  breakOffPressStillMeansTheSame,
  clampTypedBreakOffAmount,
  type BreakOffButtonAction,
} from '../../lib/jobs/jobFormBreakOff'
import { dollarWords, makeABillHeading, type WholeRestAction } from '../../lib/jobs/billTabMoney'

/** Whether "Bill part of it" is open, remembered per browser (v2.4307); a phone starts it closed. */
export const BILL_PART_OPEN_STORAGE_KEY = 'jobForm.billPartOpen'

function readPartOpen(fallback: boolean): boolean {
  try {
    const v = window.localStorage.getItem(BILL_PART_OPEN_STORAGE_KEY)
    return v == null ? fallback : v === '1'
  } catch {
    return fallback
  }
}

type JobFormMakeABillProps = {
  breakOff: ReturnType<typeof useBreakOffSlider>
  /** The job total the slider's axis runs on (line items plus riders). */
  jobTotalDollars: number
  /** The card's Left to bill (a Ready to Bill draft counts as drafted there). */
  leftToBill: number
  wholeRest: WholeRestAction | null
  onWholeRest: (action: WholeRestAction) => void
  hasOrderStages: boolean
  movingJobToReadyToBill: boolean
  creatingInvoice: boolean
  createInvoice: () => void
  moveWorkingJobToReadyToBillFromEdit: () => void
  /** Remedy line appended to the bills-ahead warning (v2.1653). */
  billsAheadRemedyHint?: string | null
}

/**
 * Edit Job → Bill, Make a bill (v2.4307): only while there is money to bill. The big button bills
 * everything left as one move (`wholeRestAction`: Working moves to Ready to Bill, Ready to Bill opens
 * Bill Customer, anything else one bill for the rest). "Bill part of it" keeps every way the old
 * break-off row had: the amount box, the slider with its arrow keys and 5% steps, the field-progress
 * dot and the bills-ahead note, plus "Up to % done". Its button still turns into Move to Ready to
 * Bill when the amount is the whole remainder, and a press counts only if the button still means
 * what it meant when the pointer went down (v2.4015).
 */
export function JobFormMakeABill({
  breakOff,
  jobTotalDollars,
  leftToBill,
  wholeRest,
  onWholeRest,
  hasOrderStages,
  movingJobToReadyToBill,
  creatingInvoice,
  createInvoice,
  moveWorkingJobToReadyToBillFromEdit,
  billsAheadRemedyHint = null,
}: JobFormMakeABillProps) {
  const {
    newInvoiceAmount,
    setNewInvoiceAmount,
    newInvoiceAmountInputFocused,
    setNewInvoiceAmountInputFocused,
    isSendFullUnallocatedToReadyToBill,
    breakOffPaidSum,
    breakOffBilledSum,
    breakOffRemaining,
    breakOffInvoiceSharePct,
    jobCompleteTrackPct,
    applyBreakOffCombinedPct,
  } = breakOff
  const narrow = useNarrowViewport640()
  const [partOpen, setPartOpen] = useState(() => readPartOpen(!narrow))
  const { showToast } = useToastContext()
  const pressedActionRef = useRef<BreakOffButtonAction | null>(null)

  const heading = makeABillHeading(breakOffRemaining, leftToBill)
  if (!heading) return null

  const busy = movingJobToReadyToBill || creatingInvoice
  const invoiceDollars = parseMoneyInputToNumber(newInvoiceAmount)
  const buttonAction = breakOffButtonAction(isSendFullUnallocatedToReadyToBill)
  const actionDisabled = busy || !(invoiceDollars > 0)
  const leavesDollars = Math.max(0, Math.round((breakOffRemaining - Math.max(0, invoiceDollars)) * 100) / 100)
  const upToDone =
    jobCompleteTrackPct != null ? breakDollarsFromCombinedPct(jobCompleteTrackPct, jobTotalDollars, breakOffPaidSum + breakOffBilledSum, breakOffRemaining) : 0

  const togglePart = () => {
    const next = !partOpen
    setPartOpen(next)
    try {
      window.localStorage.setItem(BILL_PART_OPEN_STORAGE_KEY, next ? '1' : '0')
    } catch {
      /* private window: the choice lasts this visit only */
    }
  }
  const forgetPress = () => {
    pressedActionRef.current = null
  }
  const onPartClick = () => {
    const pressed = pressedActionRef.current
    pressedActionRef.current = null
    if (!breakOffPressStillMeansTheSame(pressed, buttonAction)) {
      showToast(breakOffButtonChangedWords(buttonAction, invoiceDollars), 'info', 9000)
      return
    }
    if (buttonAction === 'move_to_ready_to_bill') moveWorkingJobToReadyToBillFromEdit()
    else createInvoice()
  }

  return (
    <section className="jobMakeBill" data-testid="make-a-bill" aria-label="Make a bill">
      <div className="jobMakeBillHd">
        <b>Make a bill</b>
        <span>
          {heading}
          {hasOrderStages ? ' · draws follow the stages' : ''}
        </span>
      </div>
      {wholeRest ? (
        <div className="jobMakeBillWhole">
          <button type="button" className="jobMakeBillWholeBtn" data-testid="bill-whole-rest" disabled={busy} onClick={() => onWholeRest(wholeRest)}>
            {busy ? 'Working…' : wholeRest.label}
          </button>
          <span className="hint">{wholeRest.hint}</span>
        </div>
      ) : null}
      <button type="button" className="jobMakeBillPartToggle" aria-expanded={partOpen} onClick={togglePart}>
        Bill part of it {partOpen ? '▴' : '▾'}
      </button>
      {partOpen ? (
        <div className="jobMakeBillPart" data-testid="bill-part">
          <div className="jobMakeBillAmountRow">
            {jobCompleteTrackPct != null && upToDone > 0 ? (
              <button
                type="button"
                className="jobMakeBillPick"
                onClick={() => applyBreakOffCombinedPct(jobCompleteTrackPct)}
                title="Bill through the job's % done"
              >
                Up to % done · {dollarWords(upToDone)}
              </button>
            ) : null}
            <label className="jobMakeBillAmount">
              $
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
                  // Typed amounts stay exact, cut back only to what is left; the 5% grid belongs to the slider.
                  setNewInvoiceAmount(String(clampTypedBreakOffAmount(n, breakOffRemaining)))
                }}
                onChange={(e) => setNewInvoiceAmount(sanitizeMoneyTyping(e.target.value))}
                placeholder="0.00"
              />
            </label>
          </div>
          <JobFormBreakOffTrack breakOff={breakOff} billsAheadRemedyHint={billsAheadRemedyHint} />
          <div className="jobMakeBillPartFoot">
            <span className="hint">
              {invoiceDollars > 0
                ? `${breakOffInvoiceSharePct != null ? `${breakOffInvoiceSharePct}% of the job · ` : ''}leaves ${dollarWords(leavesDollars)} to bill`
                : 'Type an amount or drag the slider.'}
            </span>
            <button
              type="button"
              className={buttonAction === 'move_to_ready_to_bill' ? 'jobMakeBillPartBtn move' : 'jobMakeBillPartBtn'}
              onPointerDown={() => {
                pressedActionRef.current = buttonAction
              }}
              onPointerLeave={(e) => {
                // A finger holds the button until it lifts, and its leave comes after the lift,
                // before the click — only a mouse or pen that leaves has given up the press.
                if (e.pointerType !== 'touch') forgetPress()
              }}
              onPointerCancel={forgetPress}
              onClick={onPartClick}
              disabled={actionDisabled}
            >
              {busy
                ? '…'
                : buttonAction === 'move_to_ready_to_bill'
                  ? `Move to Ready to Bill · ${dollarWords(invoiceDollars)}`
                  : `Make a ${invoiceDollars > 0 ? dollarWords(invoiceDollars) : ''} bill`.replace('  ', ' ')}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
