import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { JobLead } from '../lib/jobs/jobWindowCrewPhone'

/**
 * Our lead on a job, for a subcontractor's job window (punch list #355, v2.7380): `job_lead_contact`, a definer read,
 * since a sub reads neither the team table nor a master's row. `loaded` turns true once the read answers, with or
 * without a lead. A refused or missing function (a client ahead of its push) reads as no lead, and the window names
 * the office: it never falls back to the customer's number.
 */

type UntypedRpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>

export function useJobLeadContact(jobId: string | null | undefined, enabled: boolean): { lead: JobLead | null; loaded: boolean } {
  const [read, setRead] = useState<{ jobId: string; lead: JobLead | null } | null>(null)
  useEffect(() => {
    if (!enabled || !jobId) return
    let live = true
    // Cast the client, not `rpc.bind`: a detached `supabase.rpc` loses `this`, and binding the typed overloads trips TS2589.
    const client = supabase as unknown as { rpc: UntypedRpc }
    const none = () => live && setRead({ jobId, lead: null })
    try {
      client.rpc('job_lead_contact', { p_job_id: jobId }).then(({ data, error }) => {
        if (!live) return
        const row = !error && Array.isArray(data) ? (data[0] as { lead_name?: string | null; lead_phone?: string | null } | undefined) : undefined
        const name = (row?.lead_name ?? '').trim()
        setRead({ jobId, lead: name ? { name, phone: row?.lead_phone ?? null } : null })
      }, none)
    } catch {
      // A client that cannot make the call at all still answers: no lead, so the window names the office.
      none()
    }
    return () => {
      live = false
    }
  }, [jobId, enabled])
  const mine = enabled && read && read.jobId === jobId ? read : null
  return { lead: mine?.lead ?? null, loaded: mine != null }
}
