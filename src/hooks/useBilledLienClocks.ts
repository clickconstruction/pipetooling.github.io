import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { chunkIds } from '../lib/supabasePaging'

export type BilledLienClockJob = {
  id: string
  customer_address_id: string | null
  /** A GC on the job — the runway then asks whether the § 53.056 notice is recorded (v2.4096). */
  gc_customer_id: string | null
}

export type BilledLienClock = {
  /** '' | 'residential' | 'non_residential' from the linked property record; '' when none is linked. */
  propertyKind: string
  /** The live affidavit's filed date; null when none is on file. */
  filedYmd: string | null
  /** A live release of record; null when none. */
  releasedYmd: string | null
  /** 'YYYY-MM' months the job's live § 53.056 notices say they cover (sub jobs; empty otherwise). */
  noticedMonths: string[]
  /** A live § 53.056 notice exists on the job, whatever months it lists. */
  noticeOnFile: boolean
}

/**
 * The lien-clock facts the Pipeline's Billed and Collections rows need for
 * their runway (v2.4051): each job's property kind (the residential clock is
 * a month shorter), whether an affidavit or a release is already on file, and
 * which months a sub job's § 53.056 notices cover (v2.4096). Two small reads, chunked; null while loading, empty on error so the
 * rows simply draw no runway. Keyed on the job ids so a re-rendered but
 * unchanged list does not refetch.
 */
export function useBilledLienClocks(jobs: ReadonlyArray<BilledLienClockJob> | null, refreshKey = 0): Record<string, BilledLienClock> | null {
  const [byJob, setByJob] = useState<Record<string, BilledLienClock> | null>(null)
  const key = jobs ? jobs.map((j) => `${j.id}:${j.customer_address_id ?? ''}:${j.gc_customer_id ?? ''}`).join('|') : ''

  useEffect(() => {
    if (!jobs || jobs.length === 0) {
      setByJob(jobs ? {} : null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const jobIds = [...new Set(jobs.map((j) => j.id))]
        const addressIds = [...new Set(jobs.map((j) => j.customer_address_id).filter((v): v is string => Boolean(v)))]
        const kindById = new Map<string, string>()
        for (const chunk of chunkIds(addressIds)) {
          if (chunk.length === 0) continue
          const rows = await withSupabaseRetry(
            () => supabase.from('customer_addresses').select('id, property_kind').in('id', chunk),
            'lien runway: property kind',
          )
          for (const r of (rows ?? []) as { id: string; property_kind: string | null }[]) kindById.set(r.id, r.property_kind ?? '')
        }
        const filedByJob = new Map<string, string>()
        const releasedByJob = new Map<string, string>()
        const noticedByJob = new Map<string, Set<string>>()
        const noticeOnFile = new Set<string>()
        for (const chunk of chunkIds(jobIds)) {
          if (chunk.length === 0) continue
          const rows = await withSupabaseRetry(
            () =>
              supabase
                .from('job_lien_filings')
                .select('job_id, kind, filed_at, created_at, months_covered')
                .in('job_id', chunk)
                .in('kind', ['affidavit', 'release_of_record', 'notice_53_056'])
                .is('voided_at', null),
            'lien runway: filings',
          )
          for (const r of (rows ?? []) as { job_id: string; kind: string; filed_at: string | null; created_at: string; months_covered: string[] | null }[]) {
            if (r.kind === 'notice_53_056') {
              noticeOnFile.add(r.job_id)
              const set = noticedByJob.get(r.job_id) ?? new Set<string>()
              for (const m of r.months_covered ?? []) set.add(m.slice(0, 7))
              noticedByJob.set(r.job_id, set)
              continue
            }
            const when = (r.filed_at ?? r.created_at ?? '').slice(0, 10)
            if (!when) continue
            if (r.kind === 'affidavit') {
              const prev = filedByJob.get(r.job_id)
              if (!prev || when < prev) filedByJob.set(r.job_id, when)
            } else if (r.kind === 'release_of_record') {
              const prev = releasedByJob.get(r.job_id)
              if (!prev || when > prev) releasedByJob.set(r.job_id, when)
            }
          }
        }
        if (cancelled) return
        const next: Record<string, BilledLienClock> = {}
        for (const j of jobs) {
          next[j.id] = {
            propertyKind: j.customer_address_id ? kindById.get(j.customer_address_id) ?? '' : '',
            filedYmd: filedByJob.get(j.id) ?? null,
            releasedYmd: releasedByJob.get(j.id) ?? null,
            noticedMonths: [...(noticedByJob.get(j.id) ?? [])].sort(),
            noticeOnFile: noticeOnFile.has(j.id),
          }
        }
        setByJob(next)
      } catch {
        if (!cancelled) setByJob({})
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // v2.4153: a bump refetches for the same list — the Lien calendar's pen wrote a property kind.
  }, [key, refreshKey])

  return byJob
}
