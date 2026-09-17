/**
 * Where a shared submittal package is filed in Drive (Submittals stage 6c): the bid's job
 * folder (the one drive-intake made for the plans — bids.drive_link, or by the same name
 * under the jobs folder), a "Submittals" folder inside it, and one file per shared
 * revision: "Rev 3 · 2026-09-17.pdf". Drafts are never filed.
 */

export const SUBMITTALS_FOLDER = 'Submittals'

/** The job folder's name, exactly as drive-intake names it. */
export function jobFolderName(bid: { project_name: string | null; bid_number: string | null; id: string }): string {
  return String(bid.project_name ?? `Bid ${bid.bid_number ?? bid.id}`).trim().slice(0, 120)
}

/** "Rev 3 · 2026-09-17.pdf" — the shared date in the company calendar. */
export function packageFileName(revNumber: number, sharedAt: string | null, tz: string): string {
  const d = sharedAt ? new Date(sharedAt) : new Date()
  let ymd = ''
  if (!Number.isNaN(d.getTime())) {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d)
    const get = (t: string) => parts.find((x) => x.type === t)?.value ?? ''
    ymd = `${get('year')}-${get('month')}-${get('day')}`
  }
  return `Rev ${revNumber}${ymd ? ` · ${ymd}` : ''}.pdf`
}

/** Only a revision that left the building is filed. */
export function isFileable(status: string | null | undefined, packagePath: string | null | undefined): boolean {
  return !!packagePath && (status === 'shared' || status === 'superseded' || status === 'reviewed')
}

export function driveFileLink(id: string): string {
  return `https://drive.google.com/file/d/${id}/view`
}
