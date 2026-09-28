import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '../lib/supabase'
import { applyStandingDiscount, standingDiscountFromCustomer, standingDiscountOffer, type StandingDiscount, type StandingDiscountOffer } from '../lib/jobs/discountLine'
import type { FixtureRow } from '../lib/jobs/jobFormTypes'

export type JobStandingDiscountOffer = {
  /** Null = no chip: no standing discount, waved off, or the job already has a discount row. */
  standingOffer: StandingDiscountOffer | null
  applyStandingOffer: () => void
  waiveStandingOffer: () => void
}

/**
 * Standing discount (v2.3272), out of `JobFormModal` (the Job form map's order #4): the
 * customer's rate, read when the customer changes; the offer shows until it is applied or waved
 * off on this job. Read loosely — before the push the columns don't exist and the select errors;
 * that is "no standing discount", never a broken form. Apply writes the form's line items
 * through the setter it is handed; waving off is remembered on the job when there is one.
 */
export function useStandingDiscountOffer(params: {
  customerId: string | null
  /** The open job; null on New Job. */
  editing: { id: string; standing_discount_waived_at?: string | null } | null
  fixtures: FixtureRow[]
  setFixtures: Dispatch<SetStateAction<FixtureRow[]>>
}): JobStandingDiscountOffer {
  const { customerId, editing, fixtures, setFixtures } = params
  const [customerStanding, setCustomerStanding] = useState<StandingDiscount | null>(null)
  const [standingWaived, setStandingWaived] = useState(false)
  useEffect(() => {
    let cancelled = false
    if (!customerId) {
      setCustomerStanding(null)
      return
    }
    void (async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('standing_discount_pct, standing_discount_reason')
        .eq('id', customerId)
        .maybeSingle()
      if (cancelled) return
      setCustomerStanding(error ? null : standingDiscountFromCustomer(data))
    })()
    return () => {
      cancelled = true
    }
  }, [customerId])
  useEffect(() => {
    setStandingWaived(editing?.standing_discount_waived_at != null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read per job, not per refetch of the same job
  }, [editing?.id])
  const standingOffer = useMemo(
    () => standingDiscountOffer({ standing: customerStanding, rows: fixtures, waived: standingWaived }),
    [customerStanding, fixtures, standingWaived],
  )
  function applyStandingOffer() {
    if (!standingOffer) return
    const offer = standingOffer
    setFixtures((prev) => applyStandingDiscount(prev, offer, crypto.randomUUID()))
  }
  function waiveStandingOffer() {
    setStandingWaived(true)
    if (editing?.id) {
      void supabase
        .from('jobs_ledger')
        .update({ standing_discount_waived_at: new Date().toISOString() })
        .eq('id', editing.id)
        .then(({ error }) => {
          if (error) console.warn('standing_discount_waived_at update failed', error)
        })
    }
  }

  return { standingOffer, applyStandingOffer, waiveStandingOffer }
}
