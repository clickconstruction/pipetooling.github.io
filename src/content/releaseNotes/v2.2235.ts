import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2235',
  date: '2026-08-24',
  title: 'HR Report: write it down while it’s fresh',
  kind: 'feature',
  highlights: [
    'Masters and devs get an HR Report card on the Dashboard — pick a person, say when it happened and what you saw, good or bad, and send it to HR.',
    'Reports queue under People → HR as Pending reports; filing one appends a dated entry on that person’s record, labeled with who reported it.',
    'Authors can watch their own reports go from pending to filed; dismissing one requires a reason and nothing is ever deleted.',
  ],
}

export default note
