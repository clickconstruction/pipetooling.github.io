import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useIsDigitalTwin } from '../hooks/useIsDigitalTwin'
import { useRealtimeChannel } from '../hooks/useRealtimeChannel'
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import { customerWaitingInboxHref, type CustomerWaitingRow } from '../lib/customerWaiting'
import type { RequestInbox } from '../lib/requestPriority'

/**
 * Customer Waiting (v2.3248): the one app-wide subscription behind the banner
 * and the Needs You item. Mounted once in Layout; readers use
 * `useCustomerWaitingOptional()` (null outside the provider, so render tests
 * and hosts without the provider keep working).
 *
 * Who is eligible = who can act: dev, dispatch group members (dispatch rows),
 * estimator group members (estimator rows). Digital twins never see it — the
 * fence says twins draft only. Two lightweight queries on the partial
 * `*_open_high_idx` indexes, refreshed by realtime on both tables (UPDATE
 * events cover the call stamp and the lowering) with the hook's debounce.
 */
export type CustomerWaitingContextValue = {
  eligible: boolean
  loaded: boolean
  rows: CustomerWaitingRow[]
  /** Where "Open" lands for this viewer. */
  inboxHref: string
  /** Call / Text was used from the banner — stamp + 📞 note (silent on failure). */
  logCall: (inbox: RequestInbox, requestId: string, phoneDisplay: string) => Promise<void>
  reload: () => void
}

const CustomerWaitingContext = createContext<CustomerWaitingContextValue | null>(null)

const OPEN_HIGH_SELECT = 'id, title, created_at, reference_summary, pending_action, pending_payload, last_called_at'

export function CustomerWaitingProvider({ children }: { children: ReactNode }) {
  const { user: authUser, role } = useAuth()
  const isTwin = useIsDigitalTwin()
  const [dispatchEligible, setDispatchEligible] = useState(false)
  const [estimatorEligible, setEstimatorEligible] = useState(false)
  const [rows, setRows] = useState<CustomerWaitingRow[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!authUser?.id || isTwin) {
      setDispatchEligible(false)
      setEstimatorEligible(false)
      return
    }
    if (role === 'dev') {
      setDispatchEligible(true)
      setEstimatorEligible(true)
      return
    }
    let cancelled = false
    void Promise.all([
      supabase.from('dispatch_group_members').select('user_id').eq('user_id', authUser.id).maybeSingle(),
      supabase.from('estimator_group_members').select('user_id').eq('user_id', authUser.id).maybeSingle(),
    ]).then(([d, e]) => {
      if (cancelled) return
      setDispatchEligible(!!d.data)
      setEstimatorEligible(!!e.data)
    })
    return () => {
      cancelled = true
    }
  }, [authUser?.id, role, isTwin])

  const eligible = dispatchEligible || estimatorEligible

  const reload = useCallback(() => {
    if (!authUser?.id || !eligible) {
      setRows([])
      setLoaded(true)
      return
    }
    void (async () => {
      const out: CustomerWaitingRow[] = []
      const load = async (inbox: RequestInbox) => {
        const table = inbox === 'dispatch' ? 'dispatch_requests' : 'estimator_requests'
        const fk = inbox === 'dispatch' ? 'dispatch_requests_last_called_by_user_id_fkey' : 'estimator_requests_last_called_by_user_id_fkey'
        const { data, error } = await supabase
          .from(table)
          .select(`${OPEN_HIGH_SELECT}, last_called_by:users!${fk}(name)`)
          .eq('status', 'open')
          .eq('priority', 'high')
          .order('created_at', { ascending: true })
          .limit(50)
        if (error) {
          console.warn(`customer waiting: ${table} load failed`, error.message)
          return
        }
        for (const r of (data ?? []) as unknown as Array<Omit<CustomerWaitingRow, 'inbox'>>) out.push({ ...r, inbox })
      }
      await Promise.all([dispatchEligible ? load('dispatch') : Promise.resolve(), estimatorEligible ? load('estimator') : Promise.resolve()])
      setRows(out)
      setLoaded(true)
    })()
  }, [authUser?.id, eligible, dispatchEligible, estimatorEligible])

  useEffect(() => {
    reload()
  }, [reload])

  const dispatchFilters = useMemo(() => [{ event: '*' as const, schema: 'public', table: 'dispatch_requests' }], [])
  const estimatorFilters = useMemo(() => [{ event: '*' as const, schema: 'public', table: 'estimator_requests' }], [])
  useRealtimeChannel(!!authUser?.id && dispatchEligible, 'customer-waiting-dispatch', dispatchFilters, () => reload(), { debounceMs: 400 })
  useRealtimeChannel(!!authUser?.id && estimatorEligible, 'customer-waiting-estimator', estimatorFilters, () => reload(), { debounceMs: 400 })

  const logCall = useCallback(
    async (inbox: RequestInbox, requestId: string, phoneDisplay: string) => {
      try {
        await supabase.rpc('log_request_call', { p_inbox: inbox, p_request_id: requestId, p_phone: phoneDisplay })
        reload()
      } catch (e) {
        console.warn('log_request_call failed', e)
      }
    },
    [reload],
  )

  const canUseDispatchMode = role === 'dev' || role === 'master_technician' || isAssistantLike(role)
  const value = useMemo<CustomerWaitingContextValue>(
    () => ({ eligible, loaded, rows, inboxHref: customerWaitingInboxHref(canUseDispatchMode && dispatchEligible), logCall, reload }),
    [eligible, loaded, rows, canUseDispatchMode, dispatchEligible, logCall, reload],
  )
  return <CustomerWaitingContext.Provider value={value}>{children}</CustomerWaitingContext.Provider>
}

/** Null outside the provider (render tests, public pages). */
export function useCustomerWaitingOptional(): CustomerWaitingContextValue | null {
  return useContext(CustomerWaitingContext)
}
