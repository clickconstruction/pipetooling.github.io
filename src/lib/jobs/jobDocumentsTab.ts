/**
 * The job window's Documents tab (v2.4491): the pure pieces. The pay applications come from
 * `lib/aiaPayApplications.ts`; this file is the job's own folder links.
 */

export type JobDocumentFolderLink = { label: string; url: string }

type JobFolderFields = {
  google_drive_link?: string | null
  job_plans_link?: string | null
  job_pictures_link?: string | null
}

/** A link as the page may open it: a web address, or nothing. */
function webLink(raw: string | null | undefined): string {
  const s = (raw ?? '').trim()
  return /^https?:\/\/\S+$/i.test(s) ? s : ''
}

/** The job's folder links that are set, in the order the Edit tab lists them. */
export function jobDocumentFolderLinks(job: JobFolderFields): JobDocumentFolderLink[] {
  const all: JobDocumentFolderLink[] = [
    { label: 'Job folder', url: webLink(job.google_drive_link) },
    { label: 'Plans', url: webLink(job.job_plans_link) },
    { label: 'Pictures', url: webLink(job.job_pictures_link) },
  ]
  return all.filter((l) => l.url)
}
