/**
 * The files router's reads (`fileRoute.ts`): where a kept file's lasting link goes, source by source, as the signed-in
 * reader. A file that came on a line (`messages`) is read under the office team's policy on `message_attachments`, and
 * its copy is signed for a minute on the private `message-attachments` bucket, whose SELECT policy lets the office sign
 * it. A link it carried goes to its own address. Cut 7's Drive files are meant to be a second source.
 */
import { supabase } from '../supabase'
import type { FileSource } from './fileRoute'

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

/** Where a kept file's lasting link goes for the reader, or why it does not. */
export async function fileTarget(route: { source: FileSource; id: string }): Promise<FileTarget> {
  switch (route.source) {
    case 'messages':
      return messageFileTarget(route.id)
  }
}

/** Goes to the file in place of the page, so Back returns to where the link was pressed. */
export function goToFile(url: string): void {
  window.location.replace(url)
}
