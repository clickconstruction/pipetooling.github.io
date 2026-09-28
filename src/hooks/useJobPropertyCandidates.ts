import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '../lib/supabase'
import { type CustomerAddressRow } from '../lib/jobs/lienProperty'

/** Slim customer_addresses row for the property-record picker (v2.2638). */
export type PropertyCandidateRow = Pick<
  CustomerAddressRow,
  'id' | 'customer_id' | 'address' | 'county' | 'legal_description' | 'owner_name' | 'owner_company' | 'owner_mailing_address' | 'owner_confirmed_at' | 'property_kind' | 'homestead'
>

export type JobPropertyCandidates = {
  propertyCandidates: PropertyCandidateRow[]
  /** The fact rows add to and patch the list when a property is saved from the form. */
  setPropertyCandidates: Dispatch<SetStateAction<PropertyCandidateRow[]>>
}

/**
 * Property-record candidates (v2.2638): the job customer's + GC's saved addresses, out of
 * `JobFormModal` (the Job form map's order #4). Fail-soft; a stale link (customer changed away
 * from the row's owner) is cleared only after a SUCCESSFUL load proves it foreign. The link
 * itself stays the form's — it is an identity field the autosave carries — so the hook is handed
 * it and its setter, and reads the link as it stood when the customer or the GC last changed.
 */
export function useJobPropertyCandidates(params: {
  customerId: string | null
  gcCustomerId: string | null
  customerAddressId: string | null
  setCustomerAddressId: (id: string | null) => void
}): JobPropertyCandidates {
  const { customerId, gcCustomerId, customerAddressId, setCustomerAddressId } = params
  const [propertyCandidates, setPropertyCandidates] = useState<PropertyCandidateRow[]>([])

  useEffect(() => {
    const ids = [customerId, gcCustomerId].filter((v): v is string => Boolean(v))
    if (ids.length === 0) {
      setPropertyCandidates([])
      if (customerAddressId) setCustomerAddressId(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('customer_addresses')
          .select('id, customer_id, address, county, legal_description, owner_name, owner_company, owner_mailing_address, owner_confirmed_at, property_kind, homestead')
          .in('customer_id', ids)
          .order('sequence_order', { ascending: true })
        if (error || cancelled) return
        const rows = (data ?? []) as PropertyCandidateRow[]
        setPropertyCandidates(rows)
        if (customerAddressId && !rows.some((r) => r.id === customerAddressId)) {
          setCustomerAddressId(null)
        }
      } catch {
        // keep the current link; candidates just stay empty
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the customer and the GC are the triggers; a changed link alone never re-reads
  }, [customerId, gcCustomerId])

  return { propertyCandidates, setPropertyCandidates }
}
