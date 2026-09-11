import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { indexMatters, type LegalEntryRow, type LegalFirmRow, type LegalMatterJobRow, type LegalMatterRow, type LegalRecipientRow } from '../lib/legal/legalMatters'

// The legal_* tables land with the v2.3313 migration; until the generated types
// catch up (and on a checkout ahead of the push) the reads go through an untyped client.
const db = supabase as unknown as SupabaseClient

/**
 * The stored side of the Legal desk (PR 2): the firm, every matter with its job
 * links, and the entry stream. Office roles only (RLS); fail-soft — before the
 * migration is applied `available` is false and the desk works read-only as in PR 1.
 */
export type LegalMattersData = {
  available: boolean
  loading: boolean
  firm: LegalFirmRow | null
  firms: LegalFirmRow[]
  matters: LegalMatterRow[]
  byPayerKey: Map<string, LegalMatterRow>
  byJobId: Map<string, LegalMatterRow>
  jobIdsByMatter: Map<string, string[]>
  entriesByMatter: Map<string, LegalEntryRow[]>
  /** The firm's people and their email rules (PR 5); office read-only. */
  recipients: LegalRecipientRow[]
  firmPaused: boolean
  reload: () => Promise<void>
}

export function useLegalMatters(enabled: boolean): LegalMattersData {
  const [available, setAvailable] = useState(true)
  const [loading, setLoading] = useState(false)
  const [firms, setFirms] = useState<LegalFirmRow[]>([])
  const [matters, setMatters] = useState<LegalMatterRow[]>([])
  const [links, setLinks] = useState<LegalMatterJobRow[]>([])
  const [entries, setEntries] = useState<LegalEntryRow[]>([])
  const [recipients, setRecipients] = useState<LegalRecipientRow[]>([])
  const [firmPaused, setFirmPaused] = useState(false)

  const reload = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const [f, m, l, e, r] = await Promise.all([
        db.from('legal_firms').select('*').order('active', { ascending: false }).order('created_at'),
        db.from('legal_matters').select('*'),
        db.from('legal_matter_jobs').select('matter_id, job_id'),
        db.from('legal_matter_entries').select('*').order('created_at'),
        db.from('legal_firm_recipients').select('*').is('removed_at', null).order('created_at'),
      ])
      if (f.error || m.error || l.error || e.error) {
        // 42P01 / PGRST205: the tables aren't there yet — the desk stays read-only.
        setAvailable(false)
        return
      }
      setAvailable(true)
      setFirms((f.data ?? []) as LegalFirmRow[])
      setMatters((m.data ?? []) as LegalMatterRow[])
      setLinks((l.data ?? []) as LegalMatterJobRow[])
      setEntries((e.data ?? []) as LegalEntryRow[])
      // Recipients land with the PR 5 migration; a missing table leaves the list empty, not the desk broken.
      setRecipients(r.error ? [] : ((r.data ?? []) as LegalRecipientRow[]))
      const activeFirm = ((f.data ?? []) as Array<LegalFirmRow & { paused_at?: string | null }>).find((x) => x.active)
      setFirmPaused(Boolean(activeFirm?.paused_at))
    } catch {
      setAvailable(false)
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  const idx = useMemo(() => indexMatters(matters, links), [matters, links])
  const entriesByMatter = useMemo(() => {
    const out = new Map<string, LegalEntryRow[]>()
    for (const en of entries) out.set(en.matter_id, [...(out.get(en.matter_id) ?? []), en])
    return out
  }, [entries])

  return {
    available,
    loading,
    firm: firms.find((x) => x.active) ?? null,
    firms,
    matters,
    byPayerKey: idx.byPayerKey,
    byJobId: idx.byJobId,
    jobIdsByMatter: idx.jobIdsByMatter,
    entriesByMatter,
    recipients,
    firmPaused,
    reload,
  }
}

/** Typed wrappers over the PR 2 RPCs; each resolves to an error message or null. */
export async function legalRpc(fn: string, args: Record<string, unknown>): Promise<string | null> {
  const { data, error } = await db.rpc(fn, args)
  if (error) return error.message
  const rec = (data ?? null) as { error?: string } | null
  return rec && typeof rec.error === 'string' ? rec.error : null
}
