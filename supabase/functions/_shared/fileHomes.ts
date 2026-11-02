/**
 * Every folder the app knows a job or bid by, keyed by its Drive id, and the cached folder reads a walk up a file's
 * parents needs (v2.6305's Find a file, lifted from `drive-link` for the index in punch list #240's PR 1, v2.6319). A
 * job's three links and a bid's one; the walk itself is pure in `fileIndexKernel.ts`.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DRIVE, driveFolderIdFromUrl } from './driveUpload.ts'
import { driveGet } from './driveJobFolder.ts'
import { JOB_FOLDER_TREE } from './whereFilesGo.ts'
import type { FileHome, HomeAt } from './fileIndexKernel.ts'

export type { FileHome, HomeAt }

/** Every folder the app knows a job or bid by, keyed by its Drive id: a job's three links, a bid's one. */
export async function folderHomes(admin: SupabaseClient): Promise<Map<string, HomeAt>> {
  const homes = new Map<string, HomeAt>()
  const [jobs, bids] = await Promise.all([
    admin
      .from('jobs_ledger')
      .select('id, hcp_number, click_number, job_name, customer_id, google_drive_link, job_plans_link, job_pictures_link')
      .or('google_drive_link.not.is.null,job_plans_link.not.is.null,job_pictures_link.not.is.null')
      .limit(5000),
    admin.from('bids').select('id, bid_number, project_name, customer_id, drive_link').not('drive_link', 'is', null).limit(5000),
  ])
  type JobRow = { id: string; hcp_number: string | null; click_number: string | null; job_name: string | null; customer_id: string | null; google_drive_link: string | null; job_plans_link: string | null; job_pictures_link: string | null }
  for (const j of (jobs.data ?? []) as JobRow[]) {
    const home: FileHome = { kind: 'job', id: j.id, hcpNumber: j.hcp_number, clickNumber: j.click_number, name: j.job_name, customerId: j.customer_id }
    const links: [string | null, string | null][] = [
      [j.google_drive_link, null],
      [j.job_plans_link, JOB_FOLDER_TREE.plans],
      [j.job_pictures_link, JOB_FOLDER_TREE.pictures],
    ]
    for (const [link, via] of links) {
      const id = driveFolderIdFromUrl(link)
      if (id && !homes.has(id)) homes.set(id, { home, via })
    }
  }
  type BidRow = { id: string; bid_number: string | null; project_name: string | null; customer_id: string | null; drive_link: string | null }
  for (const b of (bids.data ?? []) as BidRow[]) {
    const id = driveFolderIdFromUrl(b.drive_link)
    if (id && !homes.has(id)) homes.set(id, { home: { kind: 'bid', id: b.id, number: b.bid_number, name: b.project_name, customerId: b.customer_id }, via: null })
  }
  return homes
}

/** A folder's name and parent, read once per id and shared by every walk of one request. */
export function folderMetaReader(google: string): (id: string) => Promise<{ name: string; parent: string | null }> {
  const cache = new Map<string, Promise<{ name: string; parent: string | null }>>()
  return (id: string) => {
    let p = cache.get(id)
    if (!p) {
      p = driveGet<{ name?: string; parents?: string[] }>(google, `${DRIVE}/files/${encodeURIComponent(id)}?fields=name,parents&supportsAllDrives=true`).then((m) => ({
        name: m.name ?? '',
        parent: m.parents?.[0] ?? null,
      }))
      cache.set(id, p)
    }
    return p
  }
}
