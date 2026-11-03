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
/** Every row of a query, a thousand at a time in a fixed order: PostgREST caps one answer at a thousand rows, whatever the limit asks. */
async function allRows<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown }>): Promise<T[]> {
  const size = 1000
  const out: T[] = []
  for (let from = 0; ; from += size) {
    const { data } = await page(from, from + size - 1)
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < size) return out
  }
}

export async function folderHomes(admin: SupabaseClient): Promise<Map<string, HomeAt>> {
  const homes = new Map<string, HomeAt>()
  type JobRow = { id: string; hcp_number: string | null; click_number: string | null; job_name: string | null; customer_id: string | null; google_drive_link: string | null; job_plans_link: string | null; job_pictures_link: string | null }
  type BidRow = { id: string; bid_number: string | null; project_name: string | null; customer_id: string | null; drive_link: string | null }
  const [jobs, bids] = await Promise.all([
    allRows<JobRow>((from, to) =>
      admin
        .from('jobs_ledger')
        .select('id, hcp_number, click_number, job_name, customer_id, google_drive_link, job_plans_link, job_pictures_link')
        .or('google_drive_link.not.is.null,job_plans_link.not.is.null,job_pictures_link.not.is.null')
        .order('id')
        .range(from, to),
    ),
    allRows<BidRow>((from, to) => admin.from('bids').select('id, bid_number, project_name, customer_id, drive_link').not('drive_link', 'is', null).order('id').range(from, to)),
  ])
  for (const j of jobs) {
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
  for (const b of bids) {
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
