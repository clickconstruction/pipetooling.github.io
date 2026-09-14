import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3412',
  date: '2026-09-14',
  title: 'Lien desk: affidavits — the § 53.052 filing window per job, on the same draft → approve → file flow',
  kind: 'feature',
  highlights: [
    'The desk gains an Affidavits kind beside Notices: every unpaid job whose lien affidavit window (the 15th of the fourth month after the last month worked; the third on a residential property) closes within 30 days, with its gate — owner of record, county and legal description, a recorded notice on a job with a GC, and not a homestead.',
    'The office sends it for approval or records the leader’s word; the master approves, holds, or sends it back. Ready to file opens the Lien window’s affidavit tab to print for notarization, file with the County Clerk, and record the filing — which moves the desk row to Filed.',
    'A filed affidavit that is still unpaid points at the Legal desk. The Dashboard’s filing-window card now opens the desk on its Affidavits pile.',
  ],
}

export default note
