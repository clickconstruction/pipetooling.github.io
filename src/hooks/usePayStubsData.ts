import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '../lib/supabase'
import type { PayStubRow } from '../components/people/PeoplePayStubsTab'
import type { PayStubAdditionalLineRow, PayStubDeductionRow } from '../lib/payStubDeductions'
import type { PayStubPaymentRow } from '../lib/payStubPayments'
import type { PayStubLineMaps } from '../lib/pay/recordPayStubPayment'
import { fetchPayStubLineMaps, fetchPayStubRows, withoutPayStub, type PayStubsLoadSnapshot } from '../lib/pay/payStubsData'

export type PayStubsDataApi = {
  payStubs: PayStubRow[]
  payStubPaymentsByStubId: Record<string, PayStubPaymentRow[]>
  payStubDeductionsByStubId: Record<string, PayStubDeductionRow[]>
  payStubAdditionalByStubId: Record<string, PayStubAdditionalLineRow[]>
  /** The three maps as one value, for `payStubBalance`. */
  payStubLineMaps: PayStubLineMaps
  /** Reloads every stub and its lines; resolves to what it read, or `null` without pay access or on a failed read. */
  loadPayStubs: () => Promise<PayStubsLoadSnapshot | null>
  deletePayStub: (stub: PayStubRow) => Promise<void>
  deletingPayStubId: string | null
  payStubDeleteConfirm: PayStubRow | null
  setPayStubDeleteConfirm: Dispatch<SetStateAction<PayStubRow | null>>
}

/**
 * The pay reports and their lines: the one data layer Pay run, Balances, Offsets, Draft
 * Payroll, Catch-up, Forecast and Record payment all read (People map, order #4).
 */
export function usePayStubsData({ canAccessPay, setError }: { canAccessPay: boolean; setError: (value: string | null) => void }): PayStubsDataApi {
  const [payStubs, setPayStubs] = useState<PayStubRow[]>([])
  const [payStubPaymentsByStubId, setPayStubPaymentsByStubId] = useState<Record<string, PayStubPaymentRow[]>>({})
  const [payStubDeductionsByStubId, setPayStubDeductionsByStubId] = useState<Record<string, PayStubDeductionRow[]>>({})
  const [payStubAdditionalByStubId, setPayStubAdditionalByStubId] = useState<Record<string, PayStubAdditionalLineRow[]>>({})
  const payStubLineMaps = useMemo<PayStubLineMaps>(
    () => ({ paymentsByStubId: payStubPaymentsByStubId, deductionsByStubId: payStubDeductionsByStubId, additionalByStubId: payStubAdditionalByStubId }),
    [payStubPaymentsByStubId, payStubDeductionsByStubId, payStubAdditionalByStubId],
  )
  const [deletingPayStubId, setDeletingPayStubId] = useState<string | null>(null)
  const [payStubDeleteConfirm, setPayStubDeleteConfirm] = useState<PayStubRow | null>(null)

  async function loadPayStubs(): Promise<PayStubsLoadSnapshot | null> {
    if (!canAccessPay) return null
    try {
      // The stubs land before their lines are read, as they always have.
      const stubs = await fetchPayStubRows(supabase)
      setPayStubs(stubs)
      const maps = await fetchPayStubLineMaps(supabase, stubs.map((s) => s.id))
      setPayStubPaymentsByStubId(maps.paymentsByStubId)
      setPayStubDeductionsByStubId(maps.deductionsByStubId)
      setPayStubAdditionalByStubId(maps.additionalByStubId)
      return { stubs, ...maps }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pay reports')
      return null
    }
  }

  async function deletePayStub(stub: PayStubRow) {
    setDeletingPayStubId(stub.id)
    setError(null)
    const { error: err } = await supabase.from('pay_stubs').delete().eq('id', stub.id)
    if (err) {
      setError(err.message)
    } else {
      setPayStubs((prev) => prev.filter((s) => s.id !== stub.id))
      setPayStubPaymentsByStubId((prev) => withoutPayStub(prev, stub.id))
      setPayStubDeductionsByStubId((prev) => withoutPayStub(prev, stub.id))
      setPayStubAdditionalByStubId((prev) => withoutPayStub(prev, stub.id))
      setPayStubDeleteConfirm(null)
    }
    setDeletingPayStubId(null)
  }

  return {
    payStubs,
    payStubPaymentsByStubId,
    payStubDeductionsByStubId,
    payStubAdditionalByStubId,
    payStubLineMaps,
    loadPayStubs,
    deletePayStub,
    deletingPayStubId,
    payStubDeleteConfirm,
    setPayStubDeleteConfirm,
  }
}
