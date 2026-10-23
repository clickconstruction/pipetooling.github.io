import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { listLegalMatterDocuments, type LegalMatterDocumentRow } from '../lib/legal/legalMatterDocumentsIo'
import { supabase } from '../lib/supabase'
import { indexMatters, type LegalEntryRow, type LegalFirmRow, type LegalMatterJobRow, type LegalMatterRow, type LegalRecipientRow } from '../lib/legal/legalMatters'
import { countiesByFirm as countiesByFirmOf, type LegalFirmCountyRow } from '../lib/legal/firmCounties'
import { classifyLegalRead, legalReadRetryDelay, type LegalReadState } from '../lib/legal/legalTablesRead'

// The legal_* tables land with the v2.3313 migration; until the generated types
// catch up (and on a checkout ahead of the push) the reads go through an untyped client.
const db = supabase as unknown as SupabaseClient

/**
 * The stored side of the Legal desk (PR 2): the firm, every matter with its job
 * links, and the entry stream. Office roles only (RLS); fail-soft — before the
 * migration is applied `available` is false and the desk works read-only as in PR 1.
 * Since v2.5780 a read that fails for any other reason is retried on its own, spaced
 * out (`legalTablesRead.ts`), and `readState` says which it was so the desk tells the truth.
 */
export type LegalMattersData = {
  available: boolean
  /** `ok`, `missing` (the migration is not applied) or `failed` (the read did not go through; retried, and the desk offers Retry). */
  readState: LegalReadState
  loading: boolean
  /** The desk's one firm today: the oldest active row. PR 2 of punch list #144 replaces this read with the account's venue. */
  firm: LegalFirmRow | null
  /** Every firm row, active first. */
  firms: LegalFirmRow[]
  /** The firms that stand today (v2.5756, punch list #144); several since the one-active index went. */
  activeFirms: LegalFirmRow[]
  /** Each active firm's counties, sorted (`legal_firm_counties`, live rows); empty until the table exists. Nothing reads it before PR 2. */
  countiesByFirm: Map<string, string[]>
  matters: LegalMatterRow[]
  byPayerKey: Map<string, LegalMatterRow>
  byJobId: Map<string, LegalMatterRow>
  jobIdsByMatter: Map<string, string[]>
  entriesByMatter: Map<string, LegalEntryRow[]>
  /** The office's documents for the firm, live ones, by matter (v2.4810); empty until the table exists. */
  documentsByMatter: Map<string, LegalMatterDocumentRow[]>
  /** The firm's people and their email rules (PR 5); office read-only. */
  recipients: LegalRecipientRow[]
  firmPaused: boolean
  reload: () => Promise<void>
}

export function useLegalMatters(enabled: boolean): LegalMattersData {
  const [readState, setReadState] = useState<LegalReadState>('ok')
  /** Consecutive failed reads; the retry schedule counts from it and a good read clears it. */
  const [failures, setFailures] = useState(0)
  const [loading, setLoading] = useState(false)
  const [firms, setFirms] = useState<LegalFirmRow[]>([])
  const [matters, setMatters] = useState<LegalMatterRow[]>([])
  const [links, setLinks] = useState<LegalMatterJobRow[]>([])
  const [entries, setEntries] = useState<LegalEntryRow[]>([])
  const [recipients, setRecipients] = useState<LegalRecipientRow[]>([])
  const [documents, setDocuments] = useState<LegalMatterDocumentRow[]>([])
  const [countyRows, setCountyRows] = useState<LegalFirmCountyRow[]>([])
  const [firmPaused, setFirmPaused] = useState(false)

  const reload = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const [f, m, l, e, r, d, c] = await Promise.all([
        db.from('legal_firms').select('*').order('active', { ascending: false }).order('created_at'),
        db.from('legal_matters').select('*'),
        db.from('legal_matter_jobs').select('matter_id, job_id'),
        db.from('legal_matter_entries').select('*').order('created_at'),
        db.from('legal_firm_recipients').select('*').is('removed_at', null).order('created_at'),
        listLegalMatterDocuments(db as unknown as SupabaseClient).then((rows) => ({ data: rows, error: null }), () => ({ data: [] as LegalMatterDocumentRow[], error: 'missing' })),
        db.from('legal_firm_counties').select('*').is('until', null),
      ])
      const state = classifyLegalRead([f.error, m.error, l.error, e.error])
      if (state !== 'ok') {
        // `missing` (42P01 / PGRST205): the tables aren't there yet — the desk stays read-only.
        // `failed`: the read did not go through; the effect below tries again.
        setReadState(state)
        setFailures((n) => n + 1)
        return
      }
      setReadState('ok')
      setFailures(0)
      setFirms((f.data ?? []) as LegalFirmRow[])
      setMatters((m.data ?? []) as LegalMatterRow[])
      setLinks((l.data ?? []) as LegalMatterJobRow[])
      setEntries((e.data ?? []) as LegalEntryRow[])
      // Recipients land with the PR 5 migration; a missing table leaves the list empty, not the desk broken.
      setRecipients(r.error ? [] : ((r.data ?? []) as LegalRecipientRow[]))
      // Documents land with the v2.4810 migration; a missing table leaves the list empty, not the desk broken.
      setDocuments(d.error ? [] : (d.data ?? []))
      // Counties land with the v2.5756 migration; a missing table leaves every county uncovered, not the desk broken.
      setCountyRows(c.error ? [] : ((c.data ?? []) as LegalFirmCountyRow[]))
      const activeFirm = ((f.data ?? []) as Array<LegalFirmRow & { paused_at?: string | null }>).find((x) => x.active)
      setFirmPaused(Boolean(activeFirm?.paused_at))
    } catch {
      // A read that threw (the network, an aborted request) failed; it is not the migration missing.
      setReadState('failed')
      setFailures((n) => n + 1)
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  // v2.5780: a failed read tries again on its own, a few times, spaced out; after that the desk's Retry is the way back.
  useEffect(() => {
    if (readState !== 'failed') return
    const delay = legalReadRetryDelay(failures)
    if (delay == null) return
    const t = window.setTimeout(() => void reload(), delay)
    return () => window.clearTimeout(t)
  }, [readState, failures, reload])

  const idx = useMemo(() => indexMatters(matters, links), [matters, links])
  const entriesByMatter = useMemo(() => {
    const out = new Map<string, LegalEntryRow[]>()
    for (const en of entries) out.set(en.matter_id, [...(out.get(en.matter_id) ?? []), en])
    return out
  }, [entries])

  const activeFirms = useMemo(() => firms.filter((f) => f.active), [firms])
  const countiesByFirm = useMemo(() => countiesByFirmOf(countyRows, activeFirms), [countyRows, activeFirms])

  const documentsByMatter = useMemo(() => {
    const out = new Map<string, LegalMatterDocumentRow[]>()
    for (const doc of documents) out.set(doc.matter_id, [...(out.get(doc.matter_id) ?? []), doc])
    return out
  }, [documents])

  return {
    available: readState === 'ok',
    readState,
    loading,
    firm: firms.find((x) => x.active) ?? null,
    firms,
    activeFirms,
    countiesByFirm,
    matters,
    byPayerKey: idx.byPayerKey,
    byJobId: idx.byJobId,
    jobIdsByMatter: idx.jobIdsByMatter,
    entriesByMatter,
    documentsByMatter,
    recipients,
    firmPaused,
    reload,
  }
}

/** Like `legalRpc`, with the RPC's own answer (e.g. `matter_id` from `legal_mark_attorney_ready`). */
export async function legalRpcData(fn: string, args: Record<string, unknown>): Promise<{ error: string | null; data: Record<string, unknown> | null }> {
  const { data, error } = await db.rpc(fn, args)
  if (error) return { error: error.message, data: null }
  const rec = (data ?? null) as Record<string, unknown> | null
  return rec && typeof rec.error === 'string' ? { error: rec.error, data: rec } : { error: null, data: rec }
}

/** Typed wrappers over the PR 2 RPCs; each resolves to an error message or null. */
export async function legalRpc(fn: string, args: Record<string, unknown>): Promise<string | null> {
  const { data, error } = await db.rpc(fn, args)
  if (error) return error.message
  const rec = (data ?? null) as { error?: string } | null
  return rec && typeof rec.error === 'string' ? rec.error : null
}
