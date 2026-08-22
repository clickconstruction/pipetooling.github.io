import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2063',
  date: '2026-08-21',
  title: "Reports: you'll know if your % done didn't stick",
  kind: 'fix',
  highlights: [
    "When a report's completion percent can't be mirrored onto the job, the app now says so right after saving — before, the failure was silent and the job's % done just quietly stayed put.",
    'The report itself always saves either way; the warning only means the % on the job needs another try.',
  ],
}

export default note
