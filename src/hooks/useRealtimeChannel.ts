import { useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useRealtimeEpoch } from '../contexts/RealtimeLifecycleContext'
import { useDocumentVisibility } from './useDocumentVisibility'

/** A single postgres_changes filter on a Supabase Realtime channel.
 * `filter` is a Postgres-RLS filter string (e.g. `user_id=eq.<uuid>` or
 * `id=in.(a,b,c)`). Always prefer setting `filter` over filtering the row
 * client-side: it cuts both the WebSocket payload and the chance of a
 * needless refetch. */
export type RealtimeChannelFilter = {
  event: '*' | 'INSERT' | 'UPDATE' | 'DELETE'
  schema?: string
  table: string
  filter?: string
}

export type UseRealtimeChannelOptions = {
  /** Coalesce bursts of events into a single `onChange` call. Default 250 ms.
   * Debounce is per-table: events on different tables in the same channel each
   * get their own debounce window so multi-table channels never lose a loader. */
  debounceMs?: number
  /** When `true` (default) `onChange` is suppressed while the document is not
   * visible. The WebSocket subscription itself is *not* torn down on hide —
   * brief tab-switches do not churn Realtime tenant connections. The 5-min
   * global drop in `RealtimeLifecycleProvider` is the long-hide gate. Set this
   * to `false` only for very rare must-not-miss scenarios. */
  visibleOnly?: boolean
}

/** Minimal payload surface needed by callers to route events by table. */
export type RealtimeChannelEvent = {
  table: string
  schema: string
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
}

/**
 * Subscribe to one or more `postgres_changes` events on a single Supabase
 * Realtime channel. Bundles the four required mitigations from `RECENT_FEATURES`
 * v2.454 / Tier 1 into a single hook so feature code stays tiny:
 *
 *  1. Per-table debounce — each table gets its own debounce window so a
 *     channel that multiplexes several tables can dispatch a separate
 *     `onChange` for every table that fired in the burst.
 *  2. Visibility gate — `onChange` is suppressed while the tab is hidden,
 *     but the WebSocket stays subscribed (no churn on brief tab switches).
 *  3. Epoch dep — the global `RealtimeLifecycleProvider` drops every channel
 *     after long hidden intervals; this hook rebuilds cleanly on resume
 *     because the epoch is in the effect dep array.
 *  4. Clean unsubscribe — `supabase.removeChannel` runs on cleanup, not just
 *     on unmount.
 *
 * Filter strings should be Postgres-style (e.g. `user_id=eq.<uuid>` or
 * `id=in.(a,b,c)`) so filtering happens at Realtime, not in the browser.
 *
 * Pass a stable `channelName` per logical subscription. Within a single
 * mount-lifetime the hook tolerates filter or callback identity changes
 * without churning subscriptions: the filter array is fingerprinted via
 * JSON.stringify and the `onChange` callback is read through a ref so it
 * does not need to be wrapped in `useCallback`.
 *
 * `onChange` receives a small payload describing which table fired. When
 * multiple events arrive on the *same* table inside `debounceMs` only the
 * last one's payload is delivered for that table. Events on *different*
 * tables each have their own debounce timer and are dispatched independently.
 */
export function useRealtimeChannel(
  enabled: boolean,
  channelName: string,
  filters: ReadonlyArray<RealtimeChannelFilter>,
  onChange: (event: RealtimeChannelEvent) => void,
  opts: UseRealtimeChannelOptions = {},
): void {
  const epoch = useRealtimeEpoch()
  const visible = useDocumentVisibility()
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  // Keep the latest visibility in a ref so `fire` can read it without forcing
  // the channel-creating effect to re-run on every hide/show flip. That used
  // to tear down the WebSocket on every brief tab switch; now we keep the
  // subscription alive and just suppress dispatch while hidden.
  const visibleRef = useRef(visible)
  useEffect(() => {
    visibleRef.current = visible
  }, [visible])

  const debounceMs = opts.debounceMs ?? 250
  const visibleOnly = opts.visibleOnly ?? true

  const filtersKey = useMemo(() => JSON.stringify(filters), [filters])

  useEffect(() => {
    if (!enabled) return
    if (filters.length === 0) return

    // Per-table debounce: keyed by `${schema}:${table}` so events on different
    // tables arriving in the same burst each get their own flush. Without this
    // a multi-table channel (e.g. quickfill-people-hours-changes) would drop
    // every loader except the one matching the last event in the window.
    const tableState = new Map<
      string,
      { timer: ReturnType<typeof setTimeout>; pending: RealtimeChannelEvent }
    >()

    const fire = (payload: { table: string; schema: string; eventType: string }) => {
      if (visibleOnly && !visibleRef.current) return
      const ev: RealtimeChannelEvent = {
        table: payload.table,
        schema: payload.schema,
        eventType:
          payload.eventType === 'INSERT' || payload.eventType === 'UPDATE' || payload.eventType === 'DELETE'
            ? payload.eventType
            : 'UPDATE',
      }
      const key = `${ev.schema}:${ev.table}`
      const existing = tableState.get(key)
      if (existing) clearTimeout(existing.timer)
      const timer = setTimeout(() => {
        tableState.delete(key)
        try {
          onChangeRef.current(ev)
        } catch (err) {
          // Failures here should never crash the channel.
           
          console.error(`[useRealtimeChannel:${channelName}] onChange threw`, err)
        }
      }, debounceMs)
      tableState.set(key, { timer, pending: ev })
    }

    let channel = supabase.channel(channelName)
    for (const f of filters) {
      channel = channel.on(
        'postgres_changes',
        { event: f.event, schema: f.schema ?? 'public', table: f.table, filter: f.filter },
        fire,
      )
    }
    channel.subscribe()

    return () => {
      for (const { timer } of tableState.values()) clearTimeout(timer)
      tableState.clear()
      void supabase.removeChannel(channel)
    }
    // filters is intentionally tracked through `filtersKey` to avoid identity
    // churn across renders. `onChange` is read through `onChangeRef`.
    // `visible` is intentionally NOT in the dep array — it's read through
    // `visibleRef` from inside `fire` so brief hide/show flips do not tear
    // down the subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, epoch, channelName, filtersKey, debounceMs, visibleOnly])
}
