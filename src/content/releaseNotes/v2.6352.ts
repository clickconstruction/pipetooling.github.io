import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6352',
  date: '2026-11-02',
  title: 'Projects: one read for every role, and a line under Money in on the leader’s Dashboard (punch list #242, PR 6)',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'superintendent'],
  highlights: [
    'The leader’s Dashboard has a Projects line under Money in, the same size and shape. Closed, it counts the working projects, how many are behind and ahead, and names the worst one. Press it and it opens to the same cards as the board, with Open the board → and Close ▴, and the Dashboard remembers the choice.',
    'Everyone on the board now reads one number from one read. A superintendent sees every working project, in hours and a money percent. Only payroll sees dollars on a day.',
    'A bid that carried only part of a job’s costs no longer reads as its budget, so the false money readings of 2,000% and more are gone.',
    'A job past its labor budget now reads how far behind it really is, and the blue work-done mark sits where the work is on the strip.',
  ],
}

export default note
