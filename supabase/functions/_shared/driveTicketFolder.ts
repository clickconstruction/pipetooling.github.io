/**
 * Counter tickets (punch list #295, PR 1): the Drive folder a ticket's pages land in, Team only › Tickets under the
 * job's folder, made as needed. A ticket shows prices, so it never lands where a phone photo does (Customer Pictures,
 * `photoFolderOrWhy`). A job with no Drive folder gets one made on its first ticket, the photo sweep's own rule
 * (`FolderTree.placeJob`); a job whose folder is held answers the hold's words.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { driveFolderIdFromUrl, findOrCreateFolder } from './driveUpload.ts'
import { readDriveSettings } from './driveSettings.ts'
import { FolderTree, JOB_FOLDER_COLUMNS, type JobFolderRow } from './jobFolders.ts'
import { TICKET_FOLDER_PATH } from './ticketNames.ts'

type Row = JobFolderRow & { drive_folder_hold: string | null }

export async function ticketFolderOrWhy(admin: SupabaseClient, token: string, jobId: string): Promise<{ id: string } | { why: string }> {
  const read = async (): Promise<Row | null> => {
    const { data } = await admin.from('jobs_ledger').select(`${JOB_FOLDER_COLUMNS}, drive_folder_hold`).eq('id', jobId).maybeSingle()
    return data as Row | null
  }
  let row = await read()
  if (!row) return { why: 'That job is gone.' }
  if (!driveFolderIdFromUrl(row.google_drive_link) || row.drive_folder_hold) {
    // No folder yet, or one held: the tree places it (or says again why it cannot), with the service account's own settings.
    const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON') ?? ''
    const settings = await readDriveSettings(admin, Deno.env.get('DRIVE_JOBS_FOLDER_ID'))
    if (!settings.rootFolderId) return { why: 'The jobs root is not set yet. Set it on Documents → Where files go.' }
    const appEmail = String((JSON.parse(saJson || '{}') as { client_email?: string }).client_email ?? '')
    const tree = new FolderTree(admin, token, settings, settings.rootFolderId, appEmail)
    const placed = await tree.placeJob(row)
    if (placed.hold) return { why: placed.hold.why }
    row = (await read()) ?? row
  }
  const folderId = driveFolderIdFromUrl(row.google_drive_link ?? null)
  if (!folderId) return { why: 'That job has no Drive folder yet.' }
  let parent = folderId
  for (const name of TICKET_FOLDER_PATH) parent = (await findOrCreateFolder(token, parent, name)).id
  return { id: parent }
}
