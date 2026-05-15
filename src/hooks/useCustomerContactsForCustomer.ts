import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { SELECT_CUSTOMER_CONTACTS_WITH_CREATOR, type CustomerContactWithCreatorRow } from '../lib/noteCreatorDisplay'

export type CustomerContactRow = CustomerContactWithCreatorRow

export function useCustomerContactsForCustomer(customerId: string | null, onLoadError?: (message: string) => void) {
  const [entries, setEntries] = useState<CustomerContactRow[]>([])
  const [loading, setLoading] = useState(false)
  const onLoadErrorRef = useRef(onLoadError)
  onLoadErrorRef.current = onLoadError

  const fetchEntries = useCallback(async (id: string) => {
    const data = await withSupabaseRetry(
      async () =>
        supabase.from('customer_contacts').select(SELECT_CUSTOMER_CONTACTS_WITH_CREATOR).eq('customer_id', id).order('contact_date', { ascending: false }),
      'load customer contacts for customer'
    )
    return (data as CustomerContactRow[] | null) ?? []
  }, [])

  const refetch = useCallback(async () => {
    if (!customerId) {
      setEntries([])
      return
    }
    try {
      const rows = await fetchEntries(customerId)
      setEntries(rows)
    } catch (e) {
      onLoadErrorRef.current?.(`Failed to load customer notes: ${formatErrorMessage(e)}`)
      setEntries([])
    }
  }, [customerId, fetchEntries])

  useEffect(() => {
    if (!customerId) {
      setEntries([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const rows = await fetchEntries(customerId)
        if (!cancelled) setEntries(rows)
      } catch (e) {
        if (!cancelled) {
          onLoadErrorRef.current?.(`Failed to load customer notes: ${formatErrorMessage(e)}`)
          setEntries([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [customerId, fetchEntries])

  return { entries, loading, refetch }
}
