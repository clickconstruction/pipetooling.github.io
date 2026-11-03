import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6335',
  date: '2026-11-02',
  title: 'The superintendent’s phone reads the project’s line: the same strip as the Projects board (punch list #242, PR 4)',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'superintendent'],
  highlights: [
    'A superintendent on a project sees one more card on Job Mode, above the job’s details: whether the job is ahead or behind at this pace, on the same strip the office reads on the Projects board.',
    'The strip is the labor budget, filled by the real days the crew worked and divided by the stages, named under it. Tap a day to read who clocked, for how long, and the report.',
    'When the office set expected hours, the card reads them with who set them, when, from what and why. When the money leads the work, the card says so.',
    'When the job is behind, the card names the one move, with Set the % and Open the checklist as presses.',
  ],
}

export default note
