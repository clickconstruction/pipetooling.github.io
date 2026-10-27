import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { getPdfLoadingTask } from '../lib/pdfjsDocument'
import { readTitleBlock, type PdfTextItem } from '../lib/gc/sheets'
import type { PlanPageRow, PlanSubstrate } from '../lib/bids/planText'
import { formatErrorMessage } from '../utils/errorHandling'

// bids_plan_pages lands with 20261022..._bids_plan_pages; the generated types follow the push.
const db = supabase as unknown as SupabaseClient

export type PlanPagesState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'reading'; page: number; of: number }
  | { kind: 'ready'; pages: PlanPageRow[]; source: string | null; readAt: string | null }
  | { kind: 'none'; reason: 'no-link' | 'unreadable' | 'error'; message: string }

/** The page text, the robot's read, and the browser's own read of a set no robot has read (Robot rounds PR 6). */
export function usePlanPages(input: { bidId: string | null; plansLink: string | null; shellBidId: string | null; enabled: boolean; canWrite: boolean }): {
  state: PlanPagesState
  substrate: PlanSubstrate | null
  reload: () => void
} {
  const { bidId, plansLink, shellBidId, enabled, canWrite } = input
  const [state, setState] = useState<PlanPagesState>({ kind: 'idle' })
  const [substrate, setSubstrate] = useState<PlanSubstrate | null>(null)
  const [gen, setGen] = useState(0)
  const reload = useCallback(() => setGen((g) => g + 1), [])

  useEffect(() => {
    if (!enabled || !bidId) {
      setState({ kind: 'idle' })
      setSubstrate(null)
      return
    }
    let cancelled = false
    void (async () => {
      setState({ kind: 'loading' })
      // The robot's read, from the paired shell (read-only; never its number).
      if (shellBidId) {
        try {
          const { data } = await db.from('bids_plan_substrates').select('substrate, created_at').eq('bid_id', shellBidId).order('created_at', { ascending: false }).limit(1).maybeSingle()
          if (!cancelled) setSubstrate(((data as { substrate?: PlanSubstrate } | null)?.substrate as PlanSubstrate | undefined) ?? null)
        } catch {
          /* no read: the panel searches the text alone */
        }
      } else setSubstrate(null)
      // The page rows.
      try {
        const { data, error } = await db.from('bids_plan_pages').select('page, sheet_no, title, text, has_text, source, created_at').eq('bid_id', bidId).order('page')
        if (cancelled) return
        if (!error && data && (data as PlanPageRow[]).length > 0) {
          const rows = data as Array<PlanPageRow & { created_at: string }>
          setState({ kind: 'ready', pages: rows, source: rows[0]!.source, readAt: rows[0]!.created_at })
          return
        }
      } catch {
        /* fall through to the browser's read */
      }
      if (cancelled) return
      if (!plansLink) {
        setState({ kind: 'none', reason: 'no-link', message: 'This bid has no plans link yet.' })
        return
      }
      if (!canWrite) {
        setState({ kind: 'none', reason: 'unreadable', message: 'No robot has read this set yet.' })
        return
      }
      // The browser's read, once: pull the set through plan-fetch, read each page's text layer, save the rows.
      try {
        const { data: blob, error } = await db.functions.invoke('plan-fetch', { body: { bid: bidId } })
        if (cancelled) return
        if (error || !(blob instanceof Blob)) {
          setState({ kind: 'none', reason: 'unreadable', message: 'The plans could not be opened from here. The robot reads them on its next round.' })
          return
        }
        const bytes = await blob.arrayBuffer()
        const rows = await readPlanPages(bytes, (page, of) => { if (!cancelled) setState({ kind: 'reading', page, of }) })
        if (cancelled) return
        const { error: insErr } = await db.from('bids_plan_pages').upsert(rows.map((r) => ({ ...r, bid_id: bidId, source: 'browser' })), { onConflict: 'bid_id,page' })
        const readAt = new Date().toISOString()
        if (insErr) {
          // Not saved (a checkout ahead of the push, or no write): the read still serves this screen.
          setState({ kind: 'ready', pages: rows, source: 'browser', readAt })
          return
        }
        setState({ kind: 'ready', pages: rows, source: 'browser', readAt })
      } catch (e) {
        if (!cancelled) setState({ kind: 'none', reason: 'error', message: formatErrorMessage(e) })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bidId, plansLink, shellBidId, enabled, canWrite, gen])

  const out = useMemo(() => ({ state, substrate, reload }), [state, substrate, reload])
  return out
}

/** Every page's text layer and title block, the GC sheet index's reading (GcNewProjectSheetIndex). */
export async function readPlanPages(bytes: ArrayBuffer, onPage: (page: number, of: number) => void): Promise<PlanPageRow[]> {
  const task = await getPdfLoadingTask(bytes)
  try {
    const doc = await task.promise
    const out: PlanPageRow[] = []
    for (let n = 1; n <= doc.numPages; n++) {
      onPage(n, doc.numPages)
      const page = await doc.getPage(n)
      const [x0 = 0, y0 = 0, x1 = 0, y1 = 0] = page.view
      const content = await page.getTextContent()
      const items: PdfTextItem[] = []
      const words: string[] = []
      for (const item of content.items) {
        if (!('str' in item) || item.str.trim() === '') continue
        const t = item.transform as number[]
        items.push({ str: item.str, x: (t[4] ?? 0) - x0, y: (t[5] ?? 0) - y0, size: Math.hypot(t[2] ?? 0, t[3] ?? 0) || Math.abs(t[0] ?? 0) })
        words.push(item.str)
      }
      const sheet = readTitleBlock(items, x1 - x0, y1 - y0)
      const text = words.join(' ').replace(/\s+/g, ' ').trim().slice(0, 200_000)
      out.push({ page: n, sheet_no: sheet?.id ?? null, title: sheet?.title ?? null, text, has_text: text.length > 0, source: 'browser' })
    }
    return out
  } finally {
    void task.destroy()
  }
}
