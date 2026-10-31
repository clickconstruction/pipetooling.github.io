import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabase'
import { formatErrorMessage } from '../../../utils/errorHandling'
import { calendarYmdInAppTzFromIso, endOfYmdInAppTzMs, startOfYmdInAppTzMs } from '../../../utils/dateUtils'
import { clockWordsInAppTz, recordCheckLines, type RecordCheckLine, type StatementAffiant } from '../../../lib/legal/affidavitPaper'

/**
 * What the record says about the days a statement is about (punch list #220, v2.6210): the account's clock
 * sessions, field reports and job-thread notes dated inside the span, read for the span alone (a narrow read, not
 * the packet's whole year), folded through `recordCheckLines`. Each source fails soft and names itself, so the
 * window says *couldn't read the clock* instead of showing a clean day that is not clean. Nothing here goes on
 * the paper.
 */
export type StatementRecordCheck = { lines: RecordCheckLine[]; loading: boolean; failed: string[] }

const YMD = /^\d{4}-\d{2}-\d{2}$/
const db = supabase as unknown as SupabaseClient

type SessionRow = { user_id: string | null; job_ledger_id: string | null; work_date: string; clocked_in_at: string; clocked_out_at: string | null; rejected_at: string | null; revoked_at: string | null }
type ReportRow = { created_at: string; created_by_name: string | null; template_name: string | null }
type NoteRow = { job_id: string; body: string; created_at: string; author: { name: string | null } | Array<{ name: string | null }> | null }

export function useStatementRecordCheck(input: {
  jobs: ReadonlyArray<{ id: string; label: string }>
  incidentOn: string
  incidentTo: string
  affiant: Pick<StatementAffiant, 'userId' | 'name'>
  /** The roster, for a clock session's name. */
  users: ReadonlyArray<{ id: string; name: string | null }>
  enabled: boolean
}): StatementRecordCheck {
  const [state, setState] = useState<StatementRecordCheck>({ lines: [], loading: false, failed: [] })
  const from = YMD.test(input.incidentOn) ? input.incidentOn : ''
  const to = YMD.test(input.incidentTo) && input.incidentTo >= from ? input.incidentTo : from
  const jobsKey = input.jobs.map((j) => j.id).join(',')
  const affiantKey = `${input.affiant.userId ?? ''}|${input.affiant.name}`
  useEffect(() => {
    if (!input.enabled || !from || input.jobs.length === 0) {
      setState({ lines: [], loading: false, failed: [] })
      return
    }
    let cancelled = false
    const jobIds = input.jobs.map((j) => j.id)
    const labelOf = new Map(input.jobs.map((j) => [j.id, j.label] as const))
    const nameOf = (id: string | null) => (id ? (input.users.find((u) => u.id === id)?.name ?? null) : null)
    const fromIso = new Date(startOfYmdInAppTzMs(from)).toISOString()
    const toIso = new Date(endOfYmdInAppTzMs(to)).toISOString()
    const failed: string[] = []
    const soft = async <T,>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
      try {
        return await fn()
      } catch (e) {
        failed.push(`${name} (${formatErrorMessage(e, 'could not be read')})`)
        return fallback
      }
    }
    setState((s) => ({ ...s, loading: true }))
    void (async () => {
      const [sessions, reports, notes] = await Promise.all([
        soft<SessionRow[]>('the clock', async () => {
          const { data, error } = await db.from('clock_sessions').select('user_id, job_ledger_id, work_date, clocked_in_at, clocked_out_at, rejected_at, revoked_at').in('job_ledger_id', jobIds).gte('work_date', from).lte('work_date', to).order('clocked_in_at').limit(500)
          if (error) throw error
          return (data ?? []) as SessionRow[]
        }, []),
        soft<Array<ReportRow & { jobId: string }>>('the field reports', async () => {
          const lists = await Promise.all(jobIds.map(async (jobId) => {
            const { data, error } = await db.rpc('list_reports_for_job_ledger', { p_job_id: jobId })
            if (error) throw error
            return ((data ?? []) as ReportRow[]).map((r) => ({ ...r, jobId }))
          }))
          return lists.flat()
        }, []),
        soft<NoteRow[]>('the job thread', async () => {
          const { data, error } = await db.from('jobs_ledger_thread_notes').select('job_id, body, created_at, author:users!jobs_ledger_thread_notes_author_user_id_fkey(name)').in('job_id', jobIds).gte('created_at', fromIso).lte('created_at', toIso).order('created_at').limit(200)
          if (error) throw error
          return (data ?? []) as NoteRow[]
        }, []),
      ])
      if (cancelled) return
      const lines = recordCheckLines({
        incidentOn: from,
        incidentTo: to === from ? null : to,
        affiant: input.affiant,
        sessions: sessions.filter((s) => !s.rejected_at && !s.revoked_at && s.job_ledger_id).map((s) => ({ userId: s.user_id, userName: nameOf(s.user_id), workDate: s.work_date, clockedInAt: s.clocked_in_at, clockedOutAt: s.clocked_out_at, jobLabel: labelOf.get(s.job_ledger_id as string) ?? '' })),
        reports: reports.map((r) => ({ authorName: r.created_by_name ?? '', templateName: r.template_name ?? '', createdOn: calendarYmdInAppTzFromIso(r.created_at), jobLabel: labelOf.get(r.jobId) ?? '' })),
        notes: notes.map((n) => { const a = Array.isArray(n.author) ? (n.author[0] ?? null) : n.author; return { authorName: a?.name ?? null, createdOn: calendarYmdInAppTzFromIso(n.created_at), body: n.body } }),
        clockWords: clockWordsInAppTz,
      })
      setState({ lines, loading: false, failed })
    })()
    return () => {
      cancelled = true
    }
    // The roster is read for names, never watched; the affiant and the span are what change the read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.enabled, from, to, jobsKey, affiantKey])
  return state
}
