/**
 * The files router's reads (`fileRoute.ts`): where a kept file's lasting link goes, source by source, as the signed-in
 * reader. A file that came on a line (`messages`) is read under the office team's policy on `message_attachments`, and
 * its copy is signed for a minute on the private `message-attachments` bucket, whose SELECT policy lets the office sign
 * it. A link it carried goes to its own address. A file in a job's Drive folder (`drive`, cut 7d) is asked of
 * `drive-link`'s office door (`open`), which checks the reader is on the office team and the file is in that job's
 * folder, and answers Drive's own viewer.
 */
import { driveJobOf } from '../documents/jobFilesIo'
import { supabase } from '../supabase'
import { driveFileOfRouteId, type FileSource } from './fileRoute'

export type FileTarget = { url: string } | { problem: 'notYours' | 'notHere' }

/** How long the signed link to our copy lasts: the page goes there at once. */
export const FILE_SIGNED_SECONDS = 60

async function messageFileTarget(id: string): Promise<FileTarget> {
  const { data, error } = await supabase
    .from('message_attachments' as never)
    .select('kind, url, bucket_path')
    .eq('id', id)
    .maybeSingle()
  if (error) return { problem: 'notHere' }
  const row = data as { kind: string; url: string | null; bucket_path: string | null } | null
  // Under the policy, a row the reader may not open reads as no row.
  if (!row) return { problem: 'notYours' }
  if (row.kind === 'link') return row.url ? { url: row.url } : { problem: 'notHere' }
  if (!row.bucket_path) return { problem: 'notHere' }
  const signed = await supabase.storage.from('message-attachments').createSignedUrl(row.bucket_path, FILE_SIGNED_SECONDS)
  return signed.error || !signed.data?.signedUrl ? { problem: 'notHere' } : { url: signed.data.signedUrl }
}

async function driveFileTarget(id: string): Promise<FileTarget> {
  const file = driveFileOfRouteId(id)
  if (!file) return { problem: 'notHere' }
  const r = await supabase.functions.invoke('drive-link', { body: { action: 'open', job: driveJobOf(file.job), driveFileId: file.driveFileId } })
  if (r.error) {
    // The door says who may not (signed out, off the office team, a twin, a file outside the job's folder) with 401 or
    // 403; anything else is a file that is not there or a read that failed.
    const status = (r.error as { context?: { status?: number } }).context?.status
    return { problem: status === 401 || status === 403 ? 'notYours' : 'notHere' }
  }
  const url = (r.data as { url?: unknown } | null)?.url
  return typeof url === 'string' && url.startsWith('https://') ? { url } : { problem: 'notHere' }
}

/** Where a kept file's lasting link goes for the reader, or why it does not. */
export async function fileTarget(route: { source: FileSource; id: string }): Promise<FileTarget> {
  switch (route.source) {
    case 'messages':
      return messageFileTarget(route.id)
    case 'drive':
      return driveFileTarget(route.id)
  }
}

/** Goes to the file in place of the page, so Back returns to where the link was pressed. */
export function goToFile(url: string): void {
  window.location.replace(url)
}
