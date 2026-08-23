import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { mergeNotesIntoDisplay, type LedgerDisplayRow } from '../lib/partnerLedger/partnerLedgerJournal'
import {
  buildJournalWeekCards,
  parsePartnerLedgerNotes,
  parsePartnerLedgerOffsets,
  parsePartnerLedgerStubs,
  parsePartnerSummary,
  partnerStubsToJournal,
  type PartnerSummary,
  type WeekCard,
} from '../lib/partnerLedger/partnerWeeks'
import { parsePartnerJobCosting, parsePartnerJobsPayload, type PartnerJobCosting, type PartnerJobsPayload } from '../lib/partnerLedger/partnerJobsPayload'

/**
 * The partner's own money, self-fetched through the get_my_partner_* SECURITY
 * DEFINER RPCs (or the dev-only *_as twins when `asPartnershipId` is set —
 * same inner body, same status gate, same truth). Shared by the Dashboard
 * entry card (summary only) and the partner statement page (everything).
 *
 * One full-history ledger fetch (p_weeks 520) feeds BOTH the week cards and
 * the Full ledger (v2.2111) so the two views cannot disagree. Fail-soft:
 * `summary` stays null for non-partners and when the RPCs aren't pushed yet.
 */
export function usePartnerLedger(asPartnershipId?: string, opts: { ledger?: boolean } = {}) {
  const wantLedger = opts.ledger !== false
  const [summary, setSummary] = useState<PartnerSummary | null>(null)
  const [cards, setCards] = useState<WeekCard[]>([])
  const [fullRows, setFullRows] = useState<LedgerDisplayRow[] | null>(null)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    const sumRes = asPartnershipId
      ? await supabase.rpc('get_partner_summary_as', { p_partnership_id: asPartnershipId })
      : await supabase.rpc('get_my_partner_summary')
    if (sumRes.error) {
      setSummary(null)
      setLoaded(true)
      return
    }
    const s = parsePartnerSummary(sumRes.data)
    setSummary(s)
    if (s && wantLedger) {
      const ledRes = asPartnershipId
        ? await supabase.rpc('get_partner_ledger_as', { p_partnership_id: asPartnershipId, p_weeks: 520 })
        : await supabase.rpc('get_my_partner_ledger', { p_weeks: 520 })
      const stubs = ledRes.error ? [] : parsePartnerLedgerStubs(ledRes.data)
      const offsets = ledRes.error ? [] : parsePartnerLedgerOffsets(ledRes.data)
      const visibleNotes = ledRes.error ? [] : parsePartnerLedgerNotes(ledRes.data)
      setCards(buildJournalWeekCards(s, stubs, offsets))
      setFullRows(mergeNotesIntoDisplay(partnerStubsToJournal(stubs, offsets).rows, visibleNotes))
    }
    setLoaded(true)
  }, [asPartnershipId, wantLedger])

  useEffect(() => {
    void load()
  }, [load])

  return { summary, cards, fullRows, loaded, reload: load }
}

/** The partner's checked-off jobs (+ whether costing is on) and a lazy costing sheet per job. */
export function usePartnerJobs(asPartnershipId?: string) {
  const [jobs, setJobs] = useState<PartnerJobsPayload | null>(null)
  const [openJob, setOpenJob] = useState<string | null>(null)
  const [costing, setCosting] = useState<PartnerJobCosting | null>(null)
  const [costingErr, setCostingErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = asPartnershipId
      ? await supabase.rpc('get_partner_jobs_as', { p_partnership_id: asPartnershipId })
      : await supabase.rpc('get_my_partner_jobs')
    setJobs(error ? null : parsePartnerJobsPayload(data))
  }, [asPartnershipId])

  useEffect(() => {
    void load()
  }, [load])

  const toggleCosting = useCallback(
    async (jobId: string) => {
      if (openJob === jobId) {
        setOpenJob(null)
        setCosting(null)
        return
      }
      setOpenJob(jobId)
      setCosting(null)
      setCostingErr(null)
      const { data, error } = asPartnershipId
        ? await supabase.rpc('get_partner_job_costing_as', { p_partnership_id: asPartnershipId, p_job_id: jobId })
        : await supabase.rpc('get_my_partner_job_costing', { p_job_id: jobId })
      if (error) {
        setCostingErr(error.message)
        return
      }
      setCosting(parsePartnerJobCosting(data))
    },
    [asPartnershipId, openJob],
  )

  return { jobs, openJob, costing, costingErr, toggleCosting }
}
