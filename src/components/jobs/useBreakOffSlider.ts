import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { parseMoneyInputToNumber } from '../../lib/jobs/jobFormMoney'
import {
  BREAK_OFF_COMBINED_SLIDER_STEP_PCT,
  allocatedInvoiceDollars,
  breakDollarsFromCombinedPct,
  combinedPctFromTrackRatio,
  snapBreakOffCombinedPctToStep,
  unallocatedBillableDollars,
} from '../../lib/jobs/jobFormBreakOff'
import type { PaymentRow } from '../../lib/jobs/jobFormTypes'

/**
 * The Edit-Job "break off an invoice" combined-percent slider — the custom
 * pointer + keyboard drag track, its ~8 interdependent derived percents, and the
 * `newInvoiceAmount` it drives. Extracted verbatim from JobFormModal into a hook
 * so the modal (and, later, its Billing section component) can drop ~220 lines of
 * slider mechanics. Owns its own state/refs; reads the job total, payments, and
 * the editing job as inputs.
 */
export function useBreakOffSlider(args: {
  jobTotalBidDollars: number
  payments: PaymentRow[]
  editing: JobWithDetails | null
}) {
  const { jobTotalBidDollars, payments, editing } = args

  const [newInvoiceAmount, setNewInvoiceAmount] = useState('')
  const [newInvoiceAmountInputFocused, setNewInvoiceAmountInputFocused] = useState(false)
  const [breakOffSliderDragCombinedPct, setBreakOffSliderDragCombinedPct] = useState<number | null>(null)
  const billingBreakOffTrackRef = useRef<HTMLDivElement | null>(null)
  const breakOffSliderPointerActiveRef = useRef(false)
  const breakOffSliderLastDragCombinedRef = useRef(0)
  const breakOffSliderLastPointerXRef = useRef(0)

  const isSendFullUnallocatedToReadyToBill = useMemo(() => {
    if (!editing || editing.status !== 'working') return false
    const paidSum = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
    const remaining = unallocatedBillableDollars(jobTotalBidDollars, paidSum, editing.invoices)
    if (!(remaining > 0)) return false
    const amt = parseMoneyInputToNumber(newInvoiceAmount)
    return Math.round(amt * 100) === Math.round(remaining * 100)
  }, [editing, newInvoiceAmount, jobTotalBidDollars, payments])

  const breakOffBillingTrackPercents = useMemo(() => {
    const total = jobTotalBidDollars
    const paidSum = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
    if (!(total > 0)) {
      return { paidPct: 0, breakPreviewPct: 0, billedPct: 0, hasTotal: false as const }
    }
    const paidPct = Math.min(100, (paidSum / total) * 100)
    // Invoices already carved off (ready_to_bill + billed) render as a "Billed"
    // wall at the RIGHT end of the track — the slider's max is 100% minus this,
    // so the thumb visibly bumps into it when the job is fully carved up.
    const billedPct = Math.min(
      Math.max(0, 100 - paidPct),
      Math.max(0, (allocatedInvoiceDollars(editing?.invoices) / total) * 100),
    )
    const rawBreak = Math.max(0, parseMoneyInputToNumber(newInvoiceAmount))
    const breakPreviewPctUncapped = (rawBreak / total) * 100
    const maxBreakPreview = Math.max(0, 100 - paidPct - billedPct)
    const breakPreviewPct = Math.min(maxBreakPreview, breakPreviewPctUncapped)
    return { paidPct, breakPreviewPct, billedPct, hasTotal: true as const }
  }, [jobTotalBidDollars, payments, newInvoiceAmount, editing?.invoices])

  const jobCompleteTrackPct = useMemo(() => {
    const raw = editing?.pct_complete
    if (raw == null) return null
    const n = Number(raw)
    if (!Number.isFinite(n)) return null
    return Math.min(100, Math.max(0, n))
  }, [editing?.pct_complete])

  const breakOffPaidSum = useMemo(
    () => payments.reduce((s, p) => s + (Number(p.amount) || 0), 0),
    [payments],
  )
  const breakOffRemaining = useMemo(
    () => unallocatedBillableDollars(jobTotalBidDollars, breakOffPaidSum, editing?.invoices),
    [jobTotalBidDollars, breakOffPaidSum, editing?.invoices],
  )
  const breakOffCombinedSliderBounds = useMemo(() => {
    const total = jobTotalBidDollars
    if (!(total > 0)) return { min: 0, max: 0 }
    const min = Math.min(100, Math.max(0, (breakOffPaidSum / total) * 100))
    const max = Math.min(100, Math.max(min, ((breakOffPaidSum + breakOffRemaining) / total) * 100))
    return { min, max }
  }, [jobTotalBidDollars, breakOffPaidSum, breakOffRemaining])

  const breakOffDraftCoveragePctDisplay = useMemo(() => {
    const total = jobTotalBidDollars
    if (!(total > 0)) return null
    const b = parseMoneyInputToNumber(newInvoiceAmount)
    const pct = Math.min(100, Math.max(0, ((breakOffPaidSum + b) / total) * 100))
    return Math.round(pct)
  }, [jobTotalBidDollars, breakOffPaidSum, newInvoiceAmount])

  const breakOffCombinedHandlePct = useMemo(() => {
    const total = jobTotalBidDollars
    if (!(total > 0)) return 0
    const { min, max } = breakOffCombinedSliderBounds
    if (breakOffSliderDragCombinedPct != null) {
      return Math.min(100, Math.max(0, breakOffSliderDragCombinedPct))
    }
    const b = parseMoneyInputToNumber(newInvoiceAmount)
    const raw = Math.min(100, Math.max(0, ((breakOffPaidSum + b) / total) * 100))
    if (newInvoiceAmountInputFocused) {
      return Math.min(100, Math.max(0, raw))
    }
    return snapBreakOffCombinedPctToStep(raw, min, max)
  }, [
    jobTotalBidDollars,
    breakOffCombinedSliderBounds,
    breakOffPaidSum,
    newInvoiceAmount,
    newInvoiceAmountInputFocused,
    breakOffSliderDragCombinedPct,
  ])

  const breakOffCombinedThumbLeftPct = useMemo(() => {
    const { min, max } = breakOffCombinedSliderBounds
    return Math.min(max, Math.max(min, breakOffCombinedHandlePct))
  }, [breakOffCombinedSliderBounds, breakOffCombinedHandlePct])

  const seedBreakOffSliderFromPointerX = useCallback(
    (clientX: number) => {
      const el = billingBreakOffTrackRef.current
      const total = jobTotalBidDollars
      if (!el || !(total > 0)) return
      const rect = el.getBoundingClientRect()
      const w = rect.width || 1
      const { min, max } = breakOffCombinedSliderBounds
      // The track's visual axis is 0–100% of the job total; bounds only clamp.
      const unsnapped = combinedPctFromTrackRatio((clientX - rect.left) / w, min, max)
      breakOffSliderLastDragCombinedRef.current = unsnapped
      const combined = snapBreakOffCombinedPctToStep(unsnapped, min, max)
      setBreakOffSliderDragCombinedPct(combined)
      const bd = breakDollarsFromCombinedPct(combined, total, breakOffPaidSum, breakOffRemaining)
      setNewInvoiceAmount(String(bd))
    },
    [jobTotalBidDollars, breakOffCombinedSliderBounds, breakOffPaidSum, breakOffRemaining],
  )

  /** Quick-% buttons: set the break-off amount to a combined (paid + this bill) percent of the job total, matching the slider axis. */
  const applyBreakOffCombinedPct = useCallback(
    (pct: number) => {
      const total = jobTotalBidDollars
      if (!(total > 0)) return
      const { min, max } = breakOffCombinedSliderBounds
      const clamped = Math.min(max, Math.max(min, pct))
      const bd = breakDollarsFromCombinedPct(clamped, total, breakOffPaidSum, breakOffRemaining)
      setNewInvoiceAmount(String(bd))
      setNewInvoiceAmountInputFocused(false)
    },
    [jobTotalBidDollars, breakOffCombinedSliderBounds, breakOffPaidSum, breakOffRemaining],
  )

  const endBreakOffSliderPointerGesture = useCallback(() => {
    if (!breakOffSliderPointerActiveRef.current) return
    breakOffSliderPointerActiveRef.current = false
    breakOffSliderLastPointerXRef.current = 0
    setBreakOffSliderDragCombinedPct(null)
    const total = jobTotalBidDollars
    if (!(total > 0)) return
    const prev = breakOffSliderLastDragCombinedRef.current
    const { min, max } = breakOffCombinedSliderBounds
    const snapped = snapBreakOffCombinedPctToStep(prev, min, max)
    const bd = breakDollarsFromCombinedPct(snapped, total, breakOffPaidSum, breakOffRemaining)
    setNewInvoiceAmount(String(bd))
    setNewInvoiceAmountInputFocused(false)
  }, [jobTotalBidDollars, breakOffCombinedSliderBounds, breakOffPaidSum, breakOffRemaining])

  const onBillingBreakOffTrackPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      breakOffSliderPointerActiveRef.current = true
      e.currentTarget.setPointerCapture(e.pointerId)
      setNewInvoiceAmountInputFocused(false)
      seedBreakOffSliderFromPointerX(e.clientX)
      breakOffSliderLastPointerXRef.current = e.clientX
    },
    [seedBreakOffSliderFromPointerX],
  )

  const onBillingBreakOffTrackPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!breakOffSliderPointerActiveRef.current) return
      const el = billingBreakOffTrackRef.current
      const total = jobTotalBidDollars
      if (!el || !(total > 0)) return
      const rect = el.getBoundingClientRect()
      const w = rect.width || 1
      const { min, max } = breakOffCombinedSliderBounds
      const clientX = e.clientX
      const d = clientX - breakOffSliderLastPointerXRef.current
      breakOffSliderLastPointerXRef.current = clientX
      let next = breakOffSliderLastDragCombinedRef.current + (d / w) * 100
      next = Math.min(max, Math.max(min, next))
      breakOffSliderLastDragCombinedRef.current = next
      const snapped = snapBreakOffCombinedPctToStep(next, min, max)
      setBreakOffSliderDragCombinedPct(snapped)
      setNewInvoiceAmount(
        String(breakDollarsFromCombinedPct(snapped, total, breakOffPaidSum, breakOffRemaining)),
      )
    },
    [jobTotalBidDollars, breakOffCombinedSliderBounds, breakOffPaidSum, breakOffRemaining],
  )

  const onBillingBreakOffTrackPointerUpCancel = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }
      endBreakOffSliderPointerGesture()
    },
    [endBreakOffSliderPointerGesture],
  )

  const onBillingBreakOffTrackLostPointerCapture = useCallback(() => {
    endBreakOffSliderPointerGesture()
  }, [endBreakOffSliderPointerGesture])

  const onBreakOffSliderKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (breakOffSliderDragCombinedPct != null) return
      const total = jobTotalBidDollars
      if (!(total > 0)) return
      const { min, max } = breakOffCombinedSliderBounds
      const curSnapped = snapBreakOffCombinedPctToStep(breakOffCombinedThumbLeftPct, min, max)
      let next = curSnapped
      const step = BREAK_OFF_COMBINED_SLIDER_STEP_PCT
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault()
        next = Math.min(max, curSnapped + step)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault()
        next = Math.max(min, curSnapped - step)
      } else if (e.key === 'Home') {
        e.preventDefault()
        next = min
      } else if (e.key === 'End') {
        e.preventDefault()
        next = max
      } else {
        return
      }
      next = Math.min(max, Math.max(min, next))
      const bd = breakDollarsFromCombinedPct(next, total, breakOffPaidSum, breakOffRemaining)
      setNewInvoiceAmount(String(bd))
      setNewInvoiceAmountInputFocused(false)
    },
    [
      breakOffSliderDragCombinedPct,
      jobTotalBidDollars,
      breakOffCombinedSliderBounds,
      breakOffCombinedThumbLeftPct,
      breakOffPaidSum,
      breakOffRemaining,
    ],
  )

  return {
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
  }
}
