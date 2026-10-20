import { useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { chunkIds } from '../lib/supabasePaging'
import { useLienDeskData } from './useLienDeskData'
import { useUserDisplayNames } from './useUserDisplayNames'
import { buildLienNextUp } from '../lib/jobs/lienNextUp'
import { lienArChipFor, type LienArChip } from '../lib/jobs/lienArChip'
import { effectiveJobLedgerNumber } from '../lib/ledgerDisplayPrefixes'
import type { JobLienFilingRow } from '../lib/jobs/lienDeadlines'
import { mailPiecesByFiling as foldMailPieces, type LienMailPieceRow } from '../lib/mail/lienMailPieces'

/**
 * The lien chips for the Accounts Receivable modal's jobs (v2.5488): the Lien desk's own data
 * (its queues, Do now's rows, letter two, the filings and their mail pieces for the jobs the
 * desk lists), plus one read of the filings and pieces for the modal's jobs the desk does not
 * list — a notice sent months ago, a lien filed — so paper that is out still shows. Null until
 * the desk's data is in; a job with no chip maps to null. Fails soft: a read that fails leaves
 * that job's chip off.
 */
export function useArLienChips(
  enabled: boolean,
  jobIds: ReadonlyArray<string>,
  todayYmd: string,
  role: string | null | undefined,
  hideZzTestJobs: boolean,
): { chipsByJob: ReadonlyMap<string, LienArChip | null> | null; loading: boolean } {
  const { data, loading } = useLienDeskData(enabled, todayYmd, { light: false, hideZzTestJobs })
  const idsKey = useMemo(() => [...new Set(jobIds)].sort().join(','), [jobIds])

  // The filings and pieces for the modal's jobs the desk does not hold (a job past the desk's 30-day lead).
  const [extra, setExtra] = useState<{ key: string; filingsByJob: Record<string, JobLienFilingRow[]>; piecesByFiling: Record<string, LienMailPieceRow[]> } | null>(null)
  useEffect(() => {
    if (!enabled || !data) return
    const missing = idsKey ? idsKey.split(',').filter((id) => !(id in data.filingsByJob) && !(id in data.jobsById)) : []
    const key = `${idsKey}|${Object.keys(data.jobsById).length}`
    if (missing.length === 0) {
      setExtra({ key, filingsByJob: {}, piecesByFiling: {} })
      return
    }
    let cancelled = false
    void (async () => {
      const filingsByJob: Record<string, JobLienFilingRow[]> = {}
      for (const chunk of chunkIds(missing)) {
        if (chunk.length === 0) continue
        const part = await withSupabaseRetry(
          () => supabase.from('job_lien_filings').select('*').in('job_id', chunk).is('voided_at', null),
          'AR lien chips: filings',
        ).catch(() => [])
        for (const f of (part ?? []) as JobLienFilingRow[]) (filingsByJob[f.job_id] ??= []).push(f)
      }
      const piecesByFiling: Record<string, LienMailPieceRow[]> = {}
      const filingIds = Object.values(filingsByJob).flat().map((f) => f.id)
      for (const chunk of chunkIds(filingIds)) {
        if (chunk.length === 0) continue
        const part = await withSupabaseRetry(
          () =>
            (supabase as unknown as SupabaseClient)
              .from('mail_pieces')
              .select('id, kind, recipient, status, usps_tracking, mailed_at, delivered_at, signed_by, delivery_status, source_ids, problem')
              .overlaps('source_ids', chunk),
          'AR lien chips: mail pieces',
        ).catch(() => [])
        for (const [id, pieces] of Object.entries(foldMailPieces((part ?? []) as LienMailPieceRow[]))) piecesByFiling[id] = [...(piecesByFiling[id] ?? []), ...pieces]
      }
      if (!cancelled) setExtra({ key, filingsByJob, piecesByFiling })
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, data, idsKey])

  const masterIds = useMemo(() => (data ? Object.values(data.jobsById).map((j) => j.master_user_id) : []), [data])
  const names = useUserDisplayNames(masterIds)

  const chipsByJob = useMemo(() => {
    if (!enabled || !data) return null
    const extraReady = extra && extra.key === `${idsKey}|${Object.keys(data.jobsById).length}` ? extra : null
    const serveDue = Object.values(data.filingsByJob)
      .flat()
      .filter((f) => f.kind === 'affidavit' && f.filed_at && !f.served_at && !f.voided_at && f.serve_due)
      .map((f) => ({ jobId: f.job_id, serveDue: f.serve_due as string }))
    const nextUp = buildLienNextUp({
      notices: data.queue.entries,
      affidavits: data.affidavits.entries,
      retainage: data.retainage.entries,
      letterTwoByJob: data.letterTwoByJob,
      serveDue,
      role,
      todayYmd,
      jobTitle: (jobId) => {
        const j = data.jobsById[jobId]
        if (!j) return jobId.slice(0, 8)
        const number = effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'
        const name = (j.job_name ?? '').trim()
        return name ? `${number} · ${name}` : number
      },
      gcName: (gcId) => data.gcsById[gcId]?.name ?? 'A GC',
      leaderName: (jobId) => {
        const id = data.jobsById[jobId]?.master_user_id
        return (id ? names[id] : '')?.trim() || null
      },
      userName: (userId) => (names[userId] ?? '').trim() || null,
    })
    const entriesByJob = new Map(data.queue.entries.map((e) => [e.jobId, e] as const))
    const affidavitsByJob = new Map(data.affidavits.entries.map((e) => [e.jobId, e] as const))
    const out = new Map<string, LienArChip | null>()
    for (const jobId of idsKey ? idsKey.split(',') : []) {
      const filings = data.filingsByJob[jobId] ?? extraReady?.filingsByJob[jobId] ?? []
      const piecesByFiling: Record<string, ReadonlyArray<LienMailPieceRow>> = {}
      for (const f of filings) {
        const pieces = data.mailPiecesByFiling?.[f.id] ?? extraReady?.piecesByFiling[f.id]
        if (pieces) piecesByFiling[f.id] = pieces
      }
      out.set(
        jobId,
        lienArChipFor({
          jobId,
          todayYmd,
          nextUp,
          entry: entriesByJob.get(jobId) ?? null,
          affidavit: affidavitsByJob.get(jobId) ?? null,
          filings,
          piecesByFiling,
          letterTwo: data.letterTwoByJob[jobId] ?? null,
        }),
      )
    }
    return out
  }, [enabled, data, extra, idsKey, role, todayYmd, names])

  return { chipsByJob, loading }
}
