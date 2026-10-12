/**
 * The Messages prototype's job files (v1.91 to v1.148, `JOB_FILES`, `addDraftFile`), as the rows main keeps them, for
 * `src/lib/documents/`. Made-up jobs and files, never a live row.
 */
import type { JobFileSources } from '../../lib/documents/jobFiles'

const KB = 1024
const MB = 1024 * 1024

/** B482 Boerne Retail Shell, a bid: the addendum and the bid tab in its Drive folder, the plan set as a Drive link. */
export const BOERNE: JobFileSources = {
  planSets: [{ id: 'set-2', label: 'Boerne Retail Shell plans, rev 2', drive_url: 'https://drive.google.com/drive/folders/boerne-rev-2-folder', issued_on: '2026-10-02' }],
  drive: [
    { id: 'drv-addendum-2', name: 'Addendum 2.pdf', bytes: 412 * KB, mime: 'application/pdf', half: 'plans', url: 'https://drive.google.com/file/d/drv-addendum-2', modified: '2026-10-05T14:00:00Z' },
    { id: 'drv-bid-tab', name: 'Bid tab, Sitework.pdf', bytes: 96 * KB, mime: 'application/pdf', half: 'team_only', url: 'https://drive.google.com/file/d/drv-bid-tab', modified: '2026-10-06T14:00:00Z' },
  ],
}

/** #42 Stone Oak Pharmacy, being built: Greg's statement of work and the week's schedule. */
export const STONE_OAK: JobFileSources = {
  papers: [
    { id: 'sow-greg', paper: 'sow', name: 'Statement of work, Sitework.pdf', bytes: 210 * KB, at: '2026-09-20T15:00:00Z' },
    { id: 'sched-oct5', paper: 'schedule', name: 'Schedule, week of Oct 5.pdf', bytes: 88 * KB, at: '2026-10-05T15:00:00Z' },
  ],
}

/** #47 Helotes Dental Office, buying out: our contract with Dr. Raman and the rough schedule. */
export const HELOTES: JobFileSources = {
  papers: [
    { id: 'contract-helotes', paper: 'contract', name: 'Our contract.pdf', bytes: 340 * KB, at: '2026-09-19T15:00:00Z' },
    { id: 'sched-rough', paper: 'schedule', name: 'Schedule, rough.pdf', bytes: 72 * KB, at: '2026-09-18T15:00:00Z' },
  ],
}

/** J1077 Fair Oaks Shops, Building D: pay application 3 and change order 2. */
export const FAIR_OAKS: JobFileSources = {
  papers: [
    { id: 'payapp-3', paper: 'payapp', name: 'Pay application 3.pdf', bytes: 180 * KB, at: '2026-10-01T15:00:00Z' },
    { id: 'co-2', paper: 'co', name: 'Change order 2.pdf', bytes: 120 * KB, at: '2026-09-28T15:00:00Z' },
  ],
}

/** The file Rosa picks from her computer, and the photo from a phone. */
export const ROCK_CLAUSE = { key: 'device:rock-clause', name: 'Rock clause, marked up.pdf', bytes: 640 * KB }
export const IMG_2041 = { key: 'device:img-2041', name: 'IMG_2041.jpg', bytes: Math.round(2.1 * MB) }

export { KB, MB }
