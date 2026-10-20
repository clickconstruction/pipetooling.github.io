import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5369',
  date: '2026-10-12',
  title: 'Lien desk: the rules behind a run that shows its steps, behind the scenes (run train, PR 1)',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Four small rule sets now say, for each envelope in a run, which lane it travels, which step it is on, why it waits, and whether it is open, sealed, postmarked or delivered; and for the run, the six-step journey with its counts, the one button at the foot, and the live checklist rows.',
    'Nothing on screen changes yet. The next releases draw the run from these rules.',
  ],
}

export default note
