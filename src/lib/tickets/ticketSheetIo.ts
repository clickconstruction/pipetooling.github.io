/**
 * What the ticket sheet offers (punch list #295, PR 2): the PO codes the office made for this person today, the job
 * they are clocked in on, and the day's other jobs. Browser io, not pure; `ticketJobs.ts` orders what this reads.
 *
 * A counter is where a phone loses its signal, so the last good read is kept on the phone for the day
 * (`localStorage`), and the sheet opens on it when the read fails. Nothing here throws: a part that does not read is
 * left out, and the sheet still offers *Another job…*, *Not for one job* and *Pick the job later*.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { formatJobLedgerNumberLabel, resolveJobLedgerPrefix, type LedgerPrefixMap } from '../ledgerDisplayPrefixes'
import { fetchSortModeDayJobs } from '../tally/fetchSortModeDayJobs'
import type { ChooseJobRow } from '../tally/chooseJobSearch'
import { startOfYmdInAppTzMs, todayYmdInAppTz } from '../../utils/dateUtils'
import type { TicketJobFacts, TicketJobsInput, TicketPoFacts } from './ticketJobs'

const db = supabase as unknown as SupabaseClient

export type TicketSheetFacts = Pick<TicketJobsInput, 'poEntries' | 'clockedJob' | 'dayJobs'>

export const EMPTY_TICKET_SHEET_FACTS: TicketSheetFacts = { poEntries: [], clockedJob: null, dayJobs: [] }

type JobRow = { id: string; hcp_number: string | null; click_number: string | null; job_name: string | null; service_type_id: string | null }

/** A job's number and name as the sheet prints them, *JP1042* and *Oak Hollow Bldg C*. */
export function ticketJobFactsOf(row: JobRow, prefixMap: LedgerPrefixMap): TicketJobFacts {
  return { jobId: row.id, label: formatJobLedgerNumberLabel(resolveJobLedgerPrefix(row.service_type_id, prefixMap), row.hcp_number, row.click_number), name: String(row.job_name ?? '').trim() }
}

/** *JP942 · Spigots replaced* as its two halves; a line with no dot is all label. */
export function splitJobMain(main: string): { label: string; name: string } {
  const i = main.indexOf(' · ')
  return i < 0 ? { label: main.trim(), name: '' } : { label: main.slice(0, i).trim(), name: main.slice(i + 3).trim() }
}

async function clockedJob(userId: string, prefixMap: LedgerPrefixMap): Promise<TicketJobFacts | null> {
  const { data } = await db
    .from('clock_sessions')
    .select('job_ledger_id')
    .eq('user_id', userId)
    .is('clocked_out_at', null)
    .is('rejected_at', null)
    .is('revoked_at', null)
    .order('clocked_in_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const jobId = (data as { job_ledger_id: string | null } | null)?.job_ledger_id
  if (!jobId) return null
  const { data: job } = await db.from('jobs_ledger').select('id, hcp_number, click_number, job_name, service_type_id').eq('id', jobId).maybeSingle()
  return job ? ticketJobFactsOf(job as JobRow, prefixMap) : null
}

type PoRow = { id: string; po_code: number | string | null; created_at: string | null; job: JobRow | null; supply_house: { name: string | null } | null }

/** The PO codes made for this person since the start of today, newest first; a code whose job they cannot read is left out. */
async function todaysPoEntries(userId: string, prefixMap: LedgerPrefixMap, now: Date): Promise<TicketPoFacts[]> {
  const since = new Date(startOfYmdInAppTzMs(todayYmdInAppTz(now))).toISOString()
  const { data } = await db
    .from('material_po_generator_entries')
    .select('id, po_code, created_at, job:jobs_ledger(id, hcp_number, click_number, job_name, service_type_id), supply_house:supply_houses(name)')
    .eq('for_user_id', userId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(10)
  const out: TicketPoFacts[] = []
  for (const r of (data ?? []) as unknown as PoRow[]) {
    if (!r.job?.id) continue
    out.push({ ...ticketJobFactsOf(r.job, prefixMap), poEntryId: r.id, poCode: String(r.po_code ?? ''), houseName: r.supply_house?.name?.trim() || null })
  }
  return out
}

async function dayJobs(userId: string, prefixMap: LedgerPrefixMap, now: Date): Promise<TicketJobFacts[]> {
  const { data } = await fetchSortModeDayJobs(userId, now.toISOString(), prefixMap)
  return data.map((j) => ({ jobId: j.id, ...splitJobMain(j.main) }))
}

const CACHE_KEY = (userId: string) => `counter-ticket-sheet:${userId}`

function readCache(userId: string, now: Date): TicketSheetFacts | null {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(CACHE_KEY(userId))
    if (!raw) return null
    const o = JSON.parse(raw) as { day?: string; facts?: TicketSheetFacts }
    return o.day === todayYmdInAppTz(now) && o.facts ? { ...EMPTY_TICKET_SHEET_FACTS, ...o.facts } : null
  } catch {
    return null
  }
}

function writeCache(userId: string, now: Date, facts: TicketSheetFacts): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(CACHE_KEY(userId), JSON.stringify({ day: todayYmdInAppTz(now), facts }))
  } catch {
    // a full or closed store keeps nothing; the next read with a signal fills the sheet
  }
}

/**
 * The sheet's facts. With a signal each part is read, best effort, and the whole is kept for the day; with none, or
 * when every part fails, today's kept read answers, else nothing. `fresh` says which it was.
 */
export async function loadTicketSheetFacts(userId: string, prefixMap: LedgerPrefixMap, now: Date = new Date()): Promise<{ facts: TicketSheetFacts; fresh: boolean }> {
  const online = typeof navigator === 'undefined' || navigator.onLine !== false
  if (online) {
    const [po, clocked, day] = await Promise.allSettled([todaysPoEntries(userId, prefixMap, now), clockedJob(userId, prefixMap), dayJobs(userId, prefixMap, now)])
    if (po.status === 'fulfilled' || clocked.status === 'fulfilled' || day.status === 'fulfilled') {
      const facts: TicketSheetFacts = {
        poEntries: po.status === 'fulfilled' ? po.value : [],
        clockedJob: clocked.status === 'fulfilled' ? clocked.value : null,
        dayJobs: day.status === 'fulfilled' ? day.value : [],
      }
      const any = facts.poEntries.length > 0 || facts.clockedJob !== null || facts.dayJobs.length > 0
      // A read that came back empty with the signal up is the truth (not clocked in, nothing scheduled) and is kept;
      // a fetch that failed inside a part comes back empty too, so an empty read never replaces a kept one that had jobs.
      const kept = readCache(userId, now)
      if (any || !kept) {
        writeCache(userId, now, facts)
        return { facts, fresh: true }
      }
      return { facts: kept, fresh: false }
    }
  }
  return { facts: readCache(userId, now) ?? EMPTY_TICKET_SHEET_FACTS, fresh: false }
}

/** Every job, for *Another job…*: the sheet's own search reads it. Empty when it does not read. */
export async function loadJobsForTicketPick(): Promise<ChooseJobRow[]> {
  const { data, error } = await db
    .from('jobs_ledger')
    .select('id, hcp_number, click_number, job_name, job_address, customer_name, service_type_id')
    .eq('billing_only', false)
    .order('hcp_number', { ascending: false })
  return error ? [] : ((data ?? []) as ChooseJobRow[])
}

/** The number and name of each job a list of tickets names, by id; a job that does not read is left out. */
export async function loadTicketJobFacts(jobIds: readonly string[], prefixMap: LedgerPrefixMap): Promise<Map<string, TicketJobFacts>> {
  const ids = [...new Set(jobIds.filter(Boolean))]
  const out = new Map<string, TicketJobFacts>()
  if (ids.length === 0) return out
  const { data } = await db.from('jobs_ledger').select('id, hcp_number, click_number, job_name, service_type_id').in('id', ids)
  for (const row of (data ?? []) as JobRow[]) out.set(row.id, ticketJobFactsOf(row, prefixMap))
  return out
}
