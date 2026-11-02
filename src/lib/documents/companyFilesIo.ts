/**
 * The io half of Documents → Company's folder (the Documents spike of 2026-11-01): the two asks of `drive-link`'s office
 * door the tab speaks to, `list_company` (the company folder's files, live from Drive) and `put_company` (a file from
 * this computer into it, as base64, up to 10 MB). The function's own words come back as the error; a read with no
 * folder set carries `why: 'no_company_folder'`, which the tab reads as its empty state. A refusal's body is read once
 * (`fnRefusal`), for the words and the reason together: supabase-js hands back the function's Response, whose body can be
 * read only once, and v2.6309 read it twice, so the reason was always lost (v2.6331).
 */
import { supabase } from '../supabase'
import { base64OfBytes } from '../../../supabase/functions/_shared/messagesEmailFiles'
import type { FnResult } from '../gc/gcIo'
import type { DriveFileRow } from './jobFiles'

/** A read or a put the function refused, with the reason it named. */
export class CompanyFolderRefused extends Error {
  readonly why: string | null
  constructor(message: string, why: string | null) {
    super(message)
    this.name = 'CompanyFolderRefused'
    this.why = why
  }
}

/** A refusal's words and reason from one read of the answer, or null when the function answered well. */
async function fnRefusal(r: FnResult, fallback: string): Promise<{ words: string; why: string | null } | null> {
  const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)
  const data = r.data as { error?: unknown; why?: unknown } | null
  if (text(data?.error)) return { words: text(data?.error)!, why: text(data?.why) }
  if (!r.error) return null
  const body = (await r.error.context?.json?.().catch(() => null)) as { error?: unknown; why?: unknown } | null
  return { words: text(body?.error) ?? text(r.error.message) ?? fallback, why: text(body?.why) }
}

export interface CompanyFilesRead {
  folder: { id: string; url: string }
  files: DriveFileRow[]
  /** The folder holds more files than one list reads. */
  capped: boolean
}

/** The company folder's files, live from Drive. Throws `CompanyFolderRefused` with `why: 'no_company_folder'` while none is set. */
export async function loadCompanyFiles(): Promise<CompanyFilesRead> {
  const r = (await supabase.functions.invoke('drive-link', { body: { action: 'list_company' } })) as FnResult
  const refused = await fnRefusal(r, 'The company folder did not read.')
  if (refused) throw new CompanyFolderRefused(refused.words, refused.why)
  const d = (r.data ?? {}) as { files?: DriveFileRow[]; capped?: boolean; folder?: { id?: string; url?: string } }
  return { folder: { id: d.folder?.id ?? '', url: d.folder?.url ?? '' }, files: d.files ?? [], capped: d.capped === true }
}

/** A file from this computer into the company folder → its Drive id and viewer link. */
export async function putCompanyFile(file: File): Promise<{ driveFileId: string; url: string }> {
  const base64 = base64OfBytes(new Uint8Array(await file.arrayBuffer()))
  const r = (await supabase.functions.invoke('drive-link', {
    body: { action: 'put_company', name: file.name, mime: file.type || 'application/octet-stream', base64 },
  })) as FnResult
  const refused = await fnRefusal(r, 'The file was not put in the company folder.')
  if (refused) throw new CompanyFolderRefused(refused.words, refused.why)
  const d = (r.data ?? {}) as { driveFileId?: string; url?: string }
  return { driveFileId: d.driveFileId ?? '', url: d.url ?? '' }
}
