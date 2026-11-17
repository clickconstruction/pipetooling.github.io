/**
 * Find a file's hits that are a signed job contract's Drive copy (punch list #377, PR 6). `drive-link` answers the
 * index's rows and Drive's own finds; this reads the contract rows whose Drive copy is among them and says which hits
 * are a paper on file, so the box can chip it *Signed contract* or *Voided contract*. The record's ids ride along only
 * for the four office roles that read `job_contracts`: an estimator finds the file, as the owner chose (the card's call
 * 1), and is never handed the door to a record they cannot read.
 *
 * Fail-soft: a database from before the Drive columns refuses them by name, and a read that fails marks nothing. The
 * search answers either way.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { contractPapersOnFile, type ContractPaperOnFile } from './jobContractDrive.ts'

/** The roles that read `job_contracts`, and so may open the record from a hit. */
export const CONTRACT_RECORD_ROLES = ['dev', 'master_technician', 'assistant', 'controller']

/** The papers on file among these Drive file ids; an empty map when there are none or the read was refused. */
export async function papersAmong(admin: SupabaseClient, driveFileIds: readonly string[]): Promise<Map<string, ContractPaperOnFile>> {
  const ids = [...new Set(driveFileIds.filter(Boolean))]
  if (ids.length === 0) return new Map()
  try {
    const { data, error } = await admin.from('job_contracts').select('id, job_id, status, voided_at, drive_file_id, drive_file_origin').in('drive_file_id', ids).limit(500)
    if (error) return new Map()
    return contractPapersOnFile((data ?? []) as Parameters<typeof contractPapersOnFile>[0])
  } catch {
    return new Map()
  }
}

/** One hit with its mark: `paper`, and for a role that reads the record, the contract and its job. */
export function withPaperMark<T extends Record<string, unknown>>(hit: T, mark: ContractPaperOnFile | undefined, role: string | null | undefined): T {
  if (!mark) return hit
  const record = CONTRACT_RECORD_ROLES.includes(String(role)) ? { contract_id: mark.contractId, contract_job_id: mark.jobId } : {}
  return { ...hit, paper: mark.paper, ...record }
}
