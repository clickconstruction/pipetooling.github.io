/**
 * useBidBasisExports (v2.3219) — the bid's marked-up plans exports and the
 * `window` listener that stamps a new one when CountTooling posts its manifest.
 *
 * Messages are accepted only from the CountTooling origins (localhost too under
 * `import.meta.env.DEV`), only for the selected bid's ref, and only in the two
 * shapes `src/lib/bids/bidBasis.ts` parses. A manifest inserts one row and
 * supersedes the earlier ones; the "loaded" notice only records the takeoff's
 * last-saved time so the card can say "takeoff changed since".
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useToastContext } from '../contexts/ToastContext'
import type { Database, Json } from '../types/database'
import {
  bidBasisInsertFromMessage,
  bidBasisTakeoffMovedSince,
  currentBidBasisExport,
  isCountToolingMessageOrigin,
  parseBidBasisExportMessage,
  parseBidBasisLoadedMessage,
  sortBidBasisExports,
  type BidBasisExportMessage,
  type BidBasisLoadedMessage,
} from '../lib/bids/bidBasis'

export type BidBasisExportRow = Database['public']['Tables']['bid_plan_basis_exports']['Row']

export type UseBidBasisExportsOptions = {
  /** Listen for CountTooling's messages on `window` (the Cover Letter card does; a read-only list does not). */
  listen?: boolean
}

export type BidBasisExportsApi = {
  rows: BidBasisExportRow[]
  current: BidBasisExportRow | null
  loading: boolean
  /** The last "loaded" notice CountTooling posted for this bid (fresh open of the takeoff). */
  loadedNotice: BidBasisLoadedMessage | null
  /** True when the takeoff was saved after the current export. */
  takeoffMoved: boolean
  /** The row the latest manifest stamped (changes identity per stamp — the waiting dialog watches it). */
  lastStamp: BidBasisExportRow | null
  stampManual: (filename: string) => Promise<BidBasisExportRow | null>
  remove: (id: string) => Promise<boolean>
  reload: () => Promise<void>
}

const EMPTY: BidBasisExportRow[] = []

export function useBidBasisExports(bidId: string | null, bidRef: string | null, options: UseBidBasisExportsOptions = {}): BidBasisExportsApi {
  const listen = options.listen !== false
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const [rows, setRows] = useState<BidBasisExportRow[]>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [loadedNotice, setLoadedNotice] = useState<BidBasisLoadedMessage | null>(null)
  const [lastStamp, setLastStamp] = useState<BidBasisExportRow | null>(null)
  const bidIdRef = useRef(bidId)
  bidIdRef.current = bidId

  const reload = useCallback(async () => {
    if (!bidId) {
      setRows(EMPTY)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('bid_plan_basis_exports')
      .select('*')
      .eq('bid_id', bidId)
      .order('exported_at', { ascending: false })
    if (bidIdRef.current !== bidId) return
    setLoading(false)
    if (error) {
      // A missing table (migration not applied yet) reads as "no exports" — the card still renders its button.
      setRows(EMPTY)
      return
    }
    setRows(sortBidBasisExports((data ?? []) as BidBasisExportRow[]))
  }, [bidId])

  useEffect(() => {
    setLoadedNotice(null)
    setLastStamp(null)
    void reload()
  }, [reload])

  const insertRow = useCallback(
    async (fields: Omit<Database['public']['Tables']['bid_plan_basis_exports']['Insert'], 'bid_id' | 'exported_by'>): Promise<BidBasisExportRow | null> => {
      if (!bidId) return null
      const { data, error } = await supabase
        .from('bid_plan_basis_exports')
        .insert({ ...fields, bid_id: bidId, exported_by: user?.id ?? null })
        .select('*')
        .single()
      if (error || !data) {
        showToast('Could not stamp the bid: ' + (error?.message ?? 'no row returned'), 'error')
        return null
      }
      const row = data as BidBasisExportRow
      // Earlier exports become history; the newest is the current one.
      await supabase
        .from('bid_plan_basis_exports')
        .update({ superseded_at: new Date().toISOString() })
        .eq('bid_id', bidId)
        .is('superseded_at', null)
        .neq('id', row.id)
      await reload()
      setLastStamp(row)
      return row
    },
    [bidId, user?.id, showToast, reload]
  )

  const stampFromMessage = useCallback(
    async (m: BidBasisExportMessage) => {
      const fields = bidBasisInsertFromMessage(m)
      const row = await insertRow({ ...fields, canvas_snapshot: (fields.canvas_snapshot ?? null) as Json | null })
      if (row) showToast(`Stamped: ${row.filename}`, 'success', 6000)
    },
    [insertRow, showToast]
  )

  const stampManual = useCallback(
    async (filename: string) => {
      const name = filename.trim()
      if (!name) return null
      const row = await insertRow({ filename: name, save_method: 'manual' })
      if (row) showToast(`Stamped by hand: ${row.filename}`, 'success', 6000)
      return row
    },
    [insertRow, showToast]
  )

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('bid_plan_basis_exports').delete().eq('id', id)
      if (error) {
        showToast('Could not remove the export: ' + error.message, 'error')
        return false
      }
      await reload()
      return true
    },
    [reload, showToast]
  )

  useEffect(() => {
    if (!listen || !bidId) return
    const allowLocal = import.meta.env.DEV
    function onMessage(e: MessageEvent) {
      if (!isCountToolingMessageOrigin(e.origin, { allowLocal })) return
      const loaded = parseBidBasisLoadedMessage(e.data)
      if (loaded) {
        if (loaded.ref && bidRef && loaded.ref !== bidRef) return
        setLoadedNotice(loaded)
        return
      }
      const m = parseBidBasisExportMessage(e.data)
      if (!m) return
      if (m.ref && bidRef && m.ref !== bidRef) {
        showToast(`CountTooling sent an export for ${m.ref}, not this bid (${bidRef}). Nothing was stamped.`, 'error', 8000)
        return
      }
      void stampFromMessage(m)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [listen, bidId, bidRef, stampFromMessage, showToast])

  const current = useMemo(() => currentBidBasisExport(rows), [rows])
  const takeoffMoved = useMemo(() => bidBasisTakeoffMovedSince(current, loadedNotice?.ctUpdatedAt ?? null), [current, loadedNotice])

  return { rows, current, loading, loadedNotice, takeoffMoved, lastStamp, stampManual, remove, reload }
}
