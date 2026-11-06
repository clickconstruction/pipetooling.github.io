/**
 * Equipment pre-use check (punch list #270): a machine's own Drive folder, the way a job has its own. The photo-save
 * sweep files every check photo there. The folder sits under the office's Fleet folder (`app_settings`
 * `drive_fleet_root_folder_id`, Documents → Where files go) and is made the first time a photo lands, its link kept
 * on `vehicles.google_drive_link`. A rental's folder is named by the agreement, so it is found when a claim comes.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { driveFolderIdFromUrl, findOrCreateFolder } from './driveUpload.ts'
import { readDriveSettings } from './driveSettings.ts'
import { NO_FLEET_FOLDER_WORDS } from './whereFilesGo.ts'
import { machineFolderName, type MachineFolderInput } from './machineWords.ts'

type VehicleRow = MachineFolderInput & { id: string; google_drive_link: string | null }

/**
 * The folder a machine's photos land in: its own link when the row has one, else one found or made under the Fleet
 * folder and written back where the link is still empty. Answers the reason instead when no Fleet folder is set.
 */
export async function machineFolderOrWhy(admin: SupabaseClient, token: string, vehicleId: string): Promise<{ id: string } | { why: string }> {
  const { data, error } = await admin.from('vehicles').select('id, unit_label, make, model, rental_from, rental_agreement_no, google_drive_link').eq('id', vehicleId).maybeSingle()
  if (error || !data) return { why: 'The machine did not read.' }
  const v = data as VehicleRow
  const have = driveFolderIdFromUrl(v.google_drive_link)
  if (have) return { id: have }
  const settings = await readDriveSettings(admin, Deno.env.get('DRIVE_JOBS_FOLDER_ID'))
  if (!settings.fleetFolderId) return { why: NO_FLEET_FOLDER_WORDS }
  const made = await findOrCreateFolder(token, settings.fleetFolderId, machineFolderName(v))
  await admin
    .from('vehicles')
    .update({ google_drive_link: `https://drive.google.com/drive/folders/${made.id}` })
    .eq('id', v.id)
    .is('google_drive_link', null)
  return { id: made.id }
}
