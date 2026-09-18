import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import { supabase } from '../lib/supabase'
import type { JobPaymentEvent } from '../lib/jobs/jobPaymentMove'

// jobs_ledger_payment_events (v2.3576) — untyped until the types regenerate after the push.
const db = supabase as unknown as SupabaseClient

/**
 * The move events touching one job (left it or arrived on it), newest first, with the other
 * job's number and name so the trace line can say where. Fail-soft: a client ahead of the
 * migration reads no events and no error. `reload` after a move.
 */
export function useJobPaymentTrace(jobId: string | null, refetchKey?: unknown): {
  events: JobPaymentEvent[]
  labelFor: (otherJobId: string) => string
  reload: () => void
} {
  const [events, setEvents] = useState<JobPaymentEvent[]>([])
  const [labels, setLabels] = useState<ReadonlyMap<string, string>>(new Map())
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!jobId) {
      setEvents([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const { data, error } = await db
          .from('jobs_ledger_payment_events')
          .select('id, kind, payment_id, from_job_id, to_job_id, amount, paid_on, reason, actor_name, created_at')
          .or(`from_job_id.eq.${jobId},to_job_id.eq.${jobId}`)
          .order('created_at', { ascending: false })
          .limit(50)
        if (cancelled) return
        if (error || !Array.isArray(data)) {
          setEvents([])
          return
        }
        const rows = data as JobPaymentEvent[]
        setEvents(rows)
        const others = [...new Set(rows.flatMap((e) => [e.from_job_id, e.to_job_id]).filter((id): id is string => !!id && id !== jobId))]
        if (others.length === 0) return
        const { data: jobs } = await db.from('jobs_ledger').select('id, hcp_number, click_number, job_name').in('id', others)
        if (cancelled) return
        const m = new Map<string, string>()
        for (const j of (jobs ?? []) as Array<{ id: string; hcp_number: string | null; click_number: string | null; job_name: string | null }>) {
          const n = (j.hcp_number ?? '').trim() || (j.click_number ?? '').trim()
          m.set(j.id, [n ? `J${n}` : null, (j.job_name ?? '').trim() || null].filter(Boolean).join(' · ') || 'another job')
        }
        setLabels(m)
      } catch {
        if (!cancelled) setEvents([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [jobId, tick, refetchKey])

  const labelFor = useCallback((id: string) => labels.get(id) ?? 'another job', [labels])
  return { events, labelFor, reload: () => setTick((t) => t + 1) }
}
