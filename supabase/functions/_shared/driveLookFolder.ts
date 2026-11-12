/**
 * First look in Google Drive (punch list #319 PR 2): the Drive folder a look's files land in, made as needed. Under
 * the customer's own folder, **Customer supplied photos**, then a folder for the look named by its day and place
 * (`firstLookDrive.ts`). The look keeps the folder's id once it is made, so a later run asks Drive nothing. A caller who
 * is not a customer yet has no folder to file into and answers the words the card shows; the customer's folder is
 * found or made by the tree's own rule (`FolderTree.customerFolder`), and a hold on it answers the hold's words.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { calendarYmdInAppTzFromIso } from './appTimeZone.ts'
import { findOrCreateFolder } from './driveUpload.ts'
import { readDriveSettings } from './driveSettings.ts'
import { CUSTOMER_SUPPLIED_FOLDER, LOOK_DRIVE_WORDS, lookFolderName } from './firstLookDrive.ts'
import { FolderTree } from './jobFolders.ts'

export type LookForFolder = { id: string; contact_id: string | null; made_at: string; place: string | null; drive_folder_id: string | null }

/** One run's tree, built on the first look that needs it. */
export type LookTree = { tree: FolderTree | null; why: string | null }

export async function lookTree(admin: SupabaseClient, token: string): Promise<LookTree> {
  const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON') ?? ''
  const settings = await readDriveSettings(admin, Deno.env.get('DRIVE_JOBS_FOLDER_ID'))
  if (!settings.rootFolderId) return { tree: null, why: 'The jobs root is not set yet. Set it on Documents → Where files go.' }
  const appEmail = String((JSON.parse(saJson || '{}') as { client_email?: string }).client_email ?? '')
  return { tree: new FolderTree(admin, token, settings, settings.rootFolderId, appEmail), why: null }
}

export async function lookFolderOrWhy(admin: SupabaseClient, token: string, look: LookForFolder, trees: LookTree): Promise<{ id: string } | { why: string }> {
  if (look.drive_folder_id) return { id: look.drive_folder_id }
  if (!look.contact_id) return { why: LOOK_DRIVE_WORDS.noCustomer }
  const { data: contact } = await admin.from('contacts').select('customer_id').eq('id', look.contact_id).maybeSingle()
  const customerId = (contact as { customer_id: string | null } | null)?.customer_id ?? null
  if (!customerId) return { why: LOOK_DRIVE_WORDS.noCustomer }
  const { data: customer } = await admin.from('customers').select('id, name, google_drive_link').eq('id', customerId).maybeSingle()
  if (!customer) return { why: LOOK_DRIVE_WORDS.noCustomer }
  if (!trees.tree) return { why: trees.why ?? 'Drive is not set up here yet.' }
  const cf = await trees.tree.customerFolder(customer as { id: string; name: string | null; google_drive_link: string | null })
  if (!cf.ok) return { why: cf.hold.why }
  const supplied = await findOrCreateFolder(token, cf.id, CUSTOMER_SUPPLIED_FOLDER)
  const own = await findOrCreateFolder(token, supplied.id, lookFolderName(calendarYmdInAppTzFromIso(look.made_at), look.place))
  await admin.from('first_looks').update({ drive_folder_id: own.id }).eq('id', look.id).is('drive_folder_id', null)
  return { id: own.id }
}
