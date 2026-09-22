import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3719',
  date: '2026-09-22',
  title: 'Lien paper: an address never ends in “Null”',
  kind: 'fix',
  highlights: [
    'Some jobs from the old imports carried the word “Null” where the zip belongs, and the § 53.056 notice, the affidavit, the demand letter and the GC run’s cover letter printed it — the notice preview caught it on job 273. Every one of those papers now reads the address without it, zip kept.',
    'The stored addresses are cleaned up too — jobs and property records alike — so Edit Job and every other screen agree with what the papers print.',
    'Put a GC on notice: the owners list in Step 1 shows the same clean address.',
  ],
}

export default note
