import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7871',
  date: '2026-11-18',
  title: 'Lien desk: a stop’s window shows the contractor’s copy on every screen',
  kind: 'fix',
  highlights: [
    'A filed lien on a job under a GC owes two copies, one to the owner and one to the original contractor. A stop’s window opened from the affidavit pane or from the job’s Lien window showed the owner’s card alone until the contractor’s copy had a record.',
    'Both now show the contractor’s card from the start, with its own press, as the notices pane already did. The count reads the same on all three, like Mail proof: 1 of 3 on file.',
    'A notice’s stop opened from the affidavit pane now lists each mailed file too.',
  ],
}

export default note
