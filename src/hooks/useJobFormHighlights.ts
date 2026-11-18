import { useEffect, useRef, useState } from 'react'

export type JobFormFocusField = 'status' | 'pct'

/**
 * The Job form's highlight and focus doors (the Job form map's second pass, cut 5; out of `JobFormModal`): the
 * five flags a deep link opens the form with, the element each one lands on, and the eight effects that scroll
 * to it, flash it and let it fade. Moved as written and called where the effects ran, so the order of the
 * form's effects is unchanged. The form's hydrate, reset and close still set the flags, through the setters
 * handed back.
 *
 * - **Billing customer**: scrolls to the customer block; clears once the job has a customer.
 * - **Line items**: scrolls to ① Line Items; fades after 2.5 s.
 * - **Payments received** (v2.3795): waits for the block to have a size, scrolls it to the middle, fades 4 s later.
 * - **Status or % done** (v2.3819, the GC run's chips): the same wait, fading 4.5 s later.
 * - **Customer Pictures link**: scrolls to the box, focuses and selects it; fades after 2.5 s.
 */
export function useJobFormHighlights({ customerId, focusFieldInitial }: { customerId: string | null; focusFieldInitial: JobFormFocusField | null }) {
  const [billingCustomerHighlight, setBillingCustomerHighlight] = useState(false)
  const [fixturesSectionHighlight, setFixturesSectionHighlight] = useState(false)
  const [paymentsReceivedHighlight, setPaymentsReceivedHighlight] = useState(false)
  const paymentsReceivedHighlightRef = useRef<HTMLDivElement | null>(null)
  // The GC run's chips (v2.3819): land on the status stepper or the % done field, ringed for a moment, then plain.
  const [focusFieldFlash, setFocusFieldFlash] = useState<JobFormFocusField | null>(focusFieldInitial)
  const focusFieldRef = useRef<HTMLDivElement | null>(null)
  const [jobPicturesLinkHighlight, setJobPicturesLinkHighlight] = useState(false)
  const billingCustomerHighlightRef = useRef<HTMLDivElement | null>(null)
  const fixturesSectionHighlightRef = useRef<HTMLDivElement | null>(null)
  const jobPicturesLinkHighlightRef = useRef<HTMLDivElement | null>(null)
  const jobPicturesLinkInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (customerId && billingCustomerHighlight) {
      setBillingCustomerHighlight(false)
    }
  }, [customerId, billingCustomerHighlight])

  useEffect(() => {
    if (!billingCustomerHighlight) return
    const id = requestAnimationFrame(() => {
      billingCustomerHighlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
    return () => cancelAnimationFrame(id)
  }, [billingCustomerHighlight])

  useEffect(() => {
    if (!fixturesSectionHighlight) return
    const id = requestAnimationFrame(() => {
      fixturesSectionHighlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
    return () => cancelAnimationFrame(id)
  }, [fixturesSectionHighlight])

  useEffect(() => {
    if (!fixturesSectionHighlight) return
    const t = window.setTimeout(() => setFixturesSectionHighlight(false), 2500)
    return () => window.clearTimeout(t)
  }, [fixturesSectionHighlight])

  // v2.3795: the bank-returned deposits card lands on ③ Payments received — scroll there, flash, fade.
  // The payments table mounts only after the job and its payments have loaded (seconds after Edit Job
  // opens from a deep link), so the scroll waits for the block to exist and the fade counts from then.
  useEffect(() => {
    if (!paymentsReceivedHighlight) return
    let tries = 0
    let fade: number | null = null
    const tick = window.setInterval(() => {
      const el = paymentsReceivedHighlightRef.current
      tries += 1
      if (el && el.getBoundingClientRect().height > 0) {
        window.clearInterval(tick)
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        fade = window.setTimeout(() => setPaymentsReceivedHighlight(false), 4000)
      } else if (tries >= 150) {
        window.clearInterval(tick)
        setPaymentsReceivedHighlight(false)
      }
    }, 100)
    return () => {
      window.clearInterval(tick)
      if (fade !== null) window.clearTimeout(fade)
    }
  }, [paymentsReceivedHighlight])

  // v2.3819: the GC run's chips land on the status stepper (Edit) or the % done field (Bill) — scroll there once it has
  // a size (the Bill region is display-toggled, the job loads after the window opens), ring it, fade.
  useEffect(() => {
    if (!focusFieldFlash) return
    let tries = 0
    let fade: number | null = null
    const tick = window.setInterval(() => {
      const el = focusFieldRef.current
      tries += 1
      if (el && el.getBoundingClientRect().height > 0) {
        window.clearInterval(tick)
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        fade = window.setTimeout(() => setFocusFieldFlash(null), 4500)
      } else if (tries >= 150) {
        window.clearInterval(tick)
        setFocusFieldFlash(null)
      }
    }, 100)
    return () => {
      window.clearInterval(tick)
      if (fade !== null) window.clearTimeout(fade)
    }
  }, [focusFieldFlash])

  useEffect(() => {
    if (!jobPicturesLinkHighlight) return
    const id = requestAnimationFrame(() => {
      jobPicturesLinkHighlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      const input = jobPicturesLinkInputRef.current
      if (input) {
        input.focus()
        try {
          input.select()
        } catch {
          // ignore environments where select() throws on empty inputs
        }
      }
    })
    return () => cancelAnimationFrame(id)
  }, [jobPicturesLinkHighlight])

  useEffect(() => {
    if (!jobPicturesLinkHighlight) return
    const t = window.setTimeout(() => setJobPicturesLinkHighlight(false), 2500)
    return () => window.clearTimeout(t)
  }, [jobPicturesLinkHighlight])

  return {
    billingCustomerHighlight,
    setBillingCustomerHighlight,
    billingCustomerHighlightRef,
    fixturesSectionHighlight,
    setFixturesSectionHighlight,
    fixturesSectionHighlightRef,
    paymentsReceivedHighlight,
    setPaymentsReceivedHighlight,
    paymentsReceivedHighlightRef,
    focusFieldFlash,
    focusFieldRef,
    jobPicturesLinkHighlight,
    setJobPicturesLinkHighlight,
    jobPicturesLinkHighlightRef,
    jobPicturesLinkInputRef,
  }
}
