import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3929',
  date: '2026-09-27',
  title: 'Edit Job: the limits on a new invoice have tests',
  kind: 'fix',
  highlights: [
    'Edit Job never bills more than what is left on a job: a typed amount is cut back to the remainder, a picked stage is refused if it would go past it, and moving a Working job to Ready to Bill takes the full amount to the cent. Those three rules are now one tested piece.',
    'Nothing on screen changes.',
  ],
}

export default note
