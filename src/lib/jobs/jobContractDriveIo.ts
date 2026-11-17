/**
 * Signed contracts in Google Drive (punch list #377, PR 4): the calls. The press on the Contract window files one paper
 * now through `job-contract-drive`; the office's own paper filings ask the same thing quietly right after their write
 * (`jobContractDriveQuiet.ts`), since a signed-in person is there and the sweep would otherwise make them wait ten
 * minutes.
 */
import { supabase } from '../supabase'
import { paperUploadPath, JOB_CONTRACT_BUCKET } from './jobContractFileWrite'
import { CONTRACT_HOLD_WORDS, type ContractDriveHoldKind, type ContractDriveRow } from './jobContractDrive'
import { sweepDriveScanCache } from './driveContractScanCache'

export { CONTRACT_FILE_MAX_BYTES } from '../../../supabase/functions/_shared/jobContractDriveFiler'
export { fileContractInDriveQuietly } from './jobContractDriveQuiet'

/** The row's Drive columns as the function answers them. */
export type ContractDriveColumns = Pick<ContractDriveRow, 'drive_file_id' | 'drive_filed_at' | 'drive_file_origin' | 'drive_file_hold' | 'drive_file_hold_words' | 'drive_file_tried_at' | 'drive_void_marked_at'>

export type ContractDriveDid = 'filed' | 'adopted' | 'found' | 'held' | 'marked' | 'nothing'

export interface ContractDrivePress {
  did: ContractDriveDid
  /** The hold's words when the paper was held. */
  heldWords: string | null
  /** The row's Drive columns as they now stand; null when the function did not send them. */
  drive: ContractDriveColumns | null
}

/** The function's answer as the screen reads it; a field missing reads as nothing done, never throws. */
export function contractDrivePressFromAnswer(data: unknown): ContractDrivePress {
  const r = (data && typeof data === 'object' ? data : {}) as { outcome?: { did?: unknown; hold?: { kind?: unknown; words?: unknown } | null } | null; drive?: unknown }
  const did = r.outcome?.did
  const known: ContractDriveDid[] = ['filed', 'adopted', 'found', 'held', 'marked', 'nothing']
  const kind = typeof r.outcome?.hold?.kind === 'string' ? (r.outcome.hold.kind as ContractDriveHoldKind) : null
  const words = typeof r.outcome?.hold?.words === 'string' && r.outcome.hold.words.trim() ? r.outcome.hold.words.trim() : kind ? CONTRACT_HOLD_WORDS[kind] ?? null : null
  return {
    did: known.includes(did as ContractDriveDid) ? (did as ContractDriveDid) : 'nothing',
    heldWords: did === 'held' ? words : null,
    drive: r.drive && typeof r.drive === 'object' ? (r.drive as ContractDriveColumns) : null,
  }
}

/** What the toast says once the press has answered. */
export function contractDrivePressWords(press: ContractDrivePress): { words: string; tone: 'success' | 'warning' } {
  switch (press.did) {
    case 'filed':
    case 'found':
      return { words: 'The signed contract is in the job’s Drive folder.', tone: 'success' }
    case 'adopted':
      return { words: 'The file in Drive is tied to this record.', tone: 'success' }
    case 'marked':
      return { words: 'The Drive copy is renamed VOIDED.', tone: 'success' }
    case 'held':
      return { words: press.heldWords ?? 'The paper is not in Drive yet.', tone: 'warning' }
    default:
      return { words: 'Nothing to file on this record.', tone: 'warning' }
  }
}

/** File one signed paper in Drive now. Throws with the function's reason when the call itself fails. */
export async function fileContractInDrive(contractId: string): Promise<ContractDrivePress> {
  const { data, error } = await supabase.functions.invoke('job-contract-drive', { body: { contract_id: contractId } })
  if (error) {
    // The function's own words ride in the response body when it answered with a refusal.
    const body = await (error as { context?: { json?: () => Promise<unknown> } }).context?.json?.().catch(() => null)
    const said = body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string' ? ((body as { error: string }).error) : ''
    throw new Error(said || error.message || 'The call to file the contract did not go through.')
  }
  const press = contractDrivePressFromAnswer(data)
  // A filing changes what the Contract sweep's Drive pass should offer: the tab's kept scan is dropped.
  if (press.did === 'filed' || press.did === 'found' || press.did === 'adopted') sweepDriveScanCache.clear()
  return press
}

/** The file types the scan picker takes: a PDF or a picture of the page. */
export const CONTRACT_SCAN_ACCEPT = 'application/pdf,image/*'

/**
 * A scan added to a signed record that has none (the hold *Nothing to file*, or a link the app cannot adopt): the file
 * goes to the contract bucket at the record's own paper path, the row keeps it, and the paper is filed in Drive now.
 */
export async function addScanToSignedContract(input: { contractId: string; file: File; authUserId: string | null }): Promise<ContractDrivePress> {
  const path = paperUploadPath(input.contractId, input.file.name)
  const { error: upErr } = await supabase.storage.from(JOB_CONTRACT_BUCKET).upload(path, input.file, { contentType: input.file.type || undefined, upsert: true })
  if (upErr) throw new Error(upErr.message || 'The scan did not upload.')
  const { error: rowErr } = await supabase.from('job_contracts').update({ paper_upload_path: path }).eq('id', input.contractId)
  if (rowErr) throw rowErr
  await supabase.from('job_contract_events').insert({ contract_id: input.contractId, event_type: 'recorded', metadata: { scan_added: true, file: true }, actor_user_id: input.authUserId })
  return fileContractInDrive(input.contractId)
}
