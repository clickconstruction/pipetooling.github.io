/**
 * The three small reads behind the office's Waiting on card (punch list #365, PR 2): who the leaders are, the lien
 * waivers that wait for a leader's signature and the job notes that tagged one. Each runs under the office's own
 * row-level security, which already lets it read these rows, so the card needs no function of its own. The Lien
 * desk's piles and the line budgets come from the reads the Dashboard already makes.
 */
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { supabase } from '../supabase'
import type { WaitingOnLeaderAsk } from './waitingOnLeader'

export type WaitingOnLeaderPerson = { id: string; name: string | null }

export type WaitingOnLeaderIo = {
  /** The leaders' live accounts. A sample, a digital twin and the walk tester are no one's leader. */
  leaders(): Promise<WaitingOnLeaderPerson[]>
  /** Waivers kept on a job, sent for a signature, with one of these people as the signer. */
  waivers(leaderIds: ReadonlyArray<string>): Promise<WaitingOnLeaderAsk[]>
  /** Tags on one of these people that nobody has answered or closed. */
  tags(leaderIds: ReadonlyArray<string>): Promise<WaitingOnLeaderAsk[]>
}

const ymd = (iso: string | null | undefined): string | null => {
  if (!iso) return null
  const day = calendarYmdInAppTzFromIso(iso)
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null
}

export const waitingOnLeaderIo: WaitingOnLeaderIo = {
  async leaders() {
    const rows = await withSupabaseRetry(async () => supabase.from('users').select('id, name, is_sample, is_digital_twin, is_walk_tester').eq('role', 'master_technician').is('archived_at', null), 'waiting on the leader: the leaders')
    return ((rows ?? []) as Array<{ id: string; name: string | null; is_sample: boolean | null; is_digital_twin: boolean | null; is_walk_tester: boolean | null }>)
      .filter((u) => u.is_sample !== true && u.is_digital_twin !== true && u.is_walk_tester !== true)
      .map((u) => ({ id: u.id, name: u.name }))
  },
  async waivers(leaderIds) {
    if (leaderIds.length === 0) return []
    const rows = await withSupabaseRetry(
      async () => supabase.from('job_lien_releases').select('job_id, signature_requested_at').eq('status', 'awaiting_signature').is('voided_at', null).not('job_id', 'is', null).in('signer_user_id', [...leaderIds]),
      'waiting on the leader: the lien waivers',
    )
    return ((rows ?? []) as Array<{ job_id: string | null; signature_requested_at: string | null }>).flatMap((r) => (r.job_id ? [{ jobId: r.job_id, askedYmd: ymd(r.signature_requested_at) }] : []))
  },
  async tags(leaderIds) {
    if (leaderIds.length === 0) return []
    const rows = await withSupabaseRetry(async () => supabase.from('jobs_ledger_note_tags').select('job_id, created_at').is('cleared_at', null).in('tagged_user_id', [...leaderIds]), 'waiting on the leader: the tagged notes')
    return ((rows ?? []) as Array<{ job_id: string; created_at: string | null }>).map((r) => ({ jobId: r.job_id, askedYmd: ymd(r.created_at) }))
  },
}
