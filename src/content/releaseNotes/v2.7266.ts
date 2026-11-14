import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7266',
  date: '2026-11-14',
  title: 'Lien affidavit: the paper says why its months line is empty',
  kind: 'fix',
  highlights: [
    'A short-form affidavit names the months the job’s recorded notices name, cut to the job’s own work. When the notice on record names other months, the paper used to print a blank there with no word on why.',
    'Now the Ask the attorney line under the gates says it: no recorded notice names a month this job was worked, then the job’s work months and the notice’s months side by side. On the Lien desk’s affidavit pane, in the job’s Lien window, on the batch help sheet and on the notice record.',
    'The dev seat’s plan_affidavit_draft reply carries the same words under no_month.',
    'Nothing is held and nothing changes on the paper. The words a sworn paper uses stay counsel’s.',
  ],
}

export default note
