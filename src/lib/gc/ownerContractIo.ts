/**
 * GC mode, the real build, the Board's B6-d-ii: the press behind our contract's send in the customer's window, on
 * B6-d-i's `gc_send_owner_contract` (migration 20261010090000). A dev's until award's door, as the function is.
 *
 * A send, in order:
 * 1. the office's own contract file (call D1), a PDF, is hashed (SHA-256) and stored in the private bucket
 *    `gc-owner-contracts` under the job's id, never replacing a file (a reminder at the same price keeps the last one);
 * 2. `gc_send_owner_contract` keeps the send with the price by line it went with (call D2) and that file.
 * The email and the signing in their portal are B6-d-iii's: until then a send is kept, and nothing is emailed.
 */
import { supabase } from '../supabase'
import { checkSupabaseError, type SupabaseResultError } from '../../utils/errorHandling'
import type { Json } from '../../types/database'

function taken<T>(result: { data: T | null; error: SupabaseResultError | null; status?: number }, operation: string): T {
  checkSupabaseError(result, operation)
  return result.data as T
}

/** The bucket B6-d-i made: private, a dev's, and a file in it is never replaced. */
export const OWNER_CONTRACT_BUCKET = 'gc-owner-contracts'

/** The largest contract file a send takes. */
export const OWNER_CONTRACT_MAX_BYTES = 15 * 1024 * 1024

/** Why a file cannot go as our contract, in words. Null: it can. */
export function contractFileProblem(file: { name: string; type: string; size: number }): string | null {
  const pdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  if (!pdf) return 'Pick a PDF of the contract.'
  if (file.size === 0) return 'That file is empty. Pick the contract again.'
  if (file.size > OWNER_CONTRACT_MAX_BYTES) return 'That file is over 15 MB. Save a smaller PDF and pick it again.'
  return null
}

/** The SHA-256 of a file's bytes, as lowercase hex: what a signature binds to. */
export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** A file already stored with an earlier send, kept for a reminder at the same price. */
export interface StoredContractFile {
  path: string
  name: string
  sha256: string
}

/** Store a new contract file under the job: `<project id>/<random id>.pdf`, its name kept as the office gave it. */
export async function storeContractFile(projectId: string, file: File): Promise<StoredContractFile> {
  const why = contractFileProblem(file)
  if (why) throw new Error(why)
  const sha256 = await sha256Hex(await file.arrayBuffer())
  const path = `${projectId}/${crypto.randomUUID()}.pdf`
  const { error } = await supabase.storage.from(OWNER_CONTRACT_BUCKET).upload(path, file, { contentType: 'application/pdf', upsert: false })
  if (error) throw new Error(`The contract file did not upload: ${error.message}`)
  return { path, name: file.name, sha256 }
}

/** Send our contract: a new file stored first, or the last send's file kept. Returns the send's id. */
export async function sendGcOwnerContract(input: {
  projectId: string
  signBy: string
  note: string
  worth: Record<string, number>
  file: File | StoredContractFile
}): Promise<string> {
  const stored = input.file instanceof File ? await storeContractFile(input.projectId, input.file) : input.file
  return taken(
    await supabase.rpc('gc_send_owner_contract', {
      p_project_id: input.projectId,
      p_sign_by: input.signBy,
      p_note: input.note,
      p_worth: input.worth as Json,
      p_file_path: stored.path,
      p_file_name: stored.name,
      p_file_sha256: stored.sha256,
    }),
    'send our contract',
  )
}

/**
 * Open our contract's own file (the Board's B2b-v-iii): a short-lived signed link from the private bucket, made on the
 * press and opened in a new tab. The bucket's select policy decides who may (`canOpenOwnerContractFile`); a refusal or
 * a missing file is thrown in words, never a dead link.
 */
export async function openOwnerContractFile(path: string): Promise<void> {
  const { data, error } = await supabase.storage.from(OWNER_CONTRACT_BUCKET).createSignedUrl(path, 120)
  if (error || !data?.signedUrl) throw new Error(error?.message ? `the file would not open: ${error.message}` : 'the file would not open.')
  window.open(data.signedUrl, '_blank', 'noopener')
}
