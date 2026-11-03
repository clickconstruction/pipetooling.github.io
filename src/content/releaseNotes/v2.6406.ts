import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6406',
  date: '2026-11-03',
  title: 'Materials on site: bring back a cage or box retired by mistake',
  kind: 'feature',
  highlights: [
    'On the phone, the toast after Retire G4 carries Undo for a minute. One press and G4 is back on the job with its label working again.',
    'On Jobs → Materials, a job’s container list ends with a Retired fold. Each retired box shows the day it was retired and a Bring back press.',
    'When a live box on the job already carries that stencil, the fold says so instead of offering the press, so no job ends up with two G4s.',
    'The box’s history is untouched either way: retiring never deleted anything, and bringing it back changes no ledger line.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'superintendent', 'primary', 'helpers'],
}

export default note
