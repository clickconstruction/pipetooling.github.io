/**
 * Documents → Where files go, the Signed contracts card (punch list #377, PR 5): the reads and the press. The card
 * counts the signed job contracts in Drive, waiting on the sweep and held, and its press runs `job-contract-drive`'s
 * sweep a page at a time until nothing is left or a page makes no headway. Both throw with their reason: the card draws
 * a failed read on the retry panel and names a failed press.
 */
import { supabase } from '../supabase'
import type { ContractDriveRow } from '../jobs/jobContractDrive'
import { sweepDriveScanCache } from '../jobs/driveContractScanCache'

/** A signed contract as the card reads it: the Drive columns, and its job for the held list's label. */
export interface ContractForDrive extends ContractDriveRow {
  job: { hcp_number: string | null; job_name: string | null; customer_name: string | null } | null
}

const COLUMNS = 'id, job_id, status, voided_at, drive_file_id, drive_file_origin, drive_file_hold, drive_file_hold_words, jobs_ledger(hcp_number, job_name, customer_name)'
const PAGE = 1000

type Raw = Omit<ContractForDrive, 'job'> & { jobs_ledger: ContractForDrive['job'] | ContractForDrive['job'][] | null }

/** Every signed job contract in force, a page at a time, so a long history does not stop at the API's row cap. */
export async function readSignedContractsForDrive(): Promise<ContractForDrive[]> {
  const out: ContractForDrive[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('job_contracts').select(COLUMNS).eq('status', 'signed').is('voided_at', null).order('id').range(from, from + PAGE - 1)
    if (error) throw error
    const page = (data ?? []) as unknown as Raw[]
    for (const r of page) {
      const { jobs_ledger, ...rest } = r
      out.push({ ...rest, job: (Array.isArray(jobs_ledger) ? jobs_ledger[0] : jobs_ledger) ?? null })
    }
    if (page.length < PAGE) break
  }
  return out
}

/** One page of the sweep as the card reads it; a field missing reads as zero, never throws. */
export interface ContractsSweepPage {
  filed: number
  held: number
  looked: number
  left: number
}

export function contractsSweepFromAnswer(data: unknown): ContractsSweepPage {
  const r = (data && typeof data === 'object' ? data : {}) as { counts?: Record<string, unknown>; left?: unknown }
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  const c = r.counts ?? {}
  return { filed: n(c.filed) + n(c.adopted) + n(c.found), held: n(c.held), looked: n(c.looked), left: n(r.left) }
}

/** The most pages one press walks, so a queue that never empties cannot hold the press for good. */
export const CONTRACTS_SWEEP_MAX_PAGES = 12

/**
 * The press: the sweep, a page at a time, until nothing is left or a page looked at nothing. The totals are what took
 * and what was held; a held paper stays on the card with its reason.
 */
export async function fileSignedContractsInDrive(onPage?: (soFar: { filed: number; held: number }) => void): Promise<{ filed: number; held: number }> {
  const total = { filed: 0, held: 0 }
  for (let i = 0; i < CONTRACTS_SWEEP_MAX_PAGES; i += 1) {
    const { data, error } = await supabase.functions.invoke('job-contract-drive', { body: { sweep: { limit: 25 } } })
    if (error) {
      const body = await (error as { context?: { json?: () => Promise<unknown> } }).context?.json?.().catch(() => null)
      const said = body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string' ? (body as { error: string }).error : ''
      throw new Error(said || error.message || 'The call to file the contracts did not go through.')
    }
    const page = contractsSweepFromAnswer(data)
    total.filed += page.filed
    total.held += page.held
    onPage?.({ ...total })
    if (page.left <= 0 || page.looked <= 0) break
  }
  if (total.filed > 0) sweepDriveScanCache.clear()
  return total
}
