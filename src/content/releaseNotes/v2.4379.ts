import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4379',
  date: '2026-10-01',
  title: 'Edit Job → Bill: ticking a line no longer fills Bill part of it',
  kind: 'fix',
  highlights: [
    'Ticking lines on the money card sets up Bill the N picked and nothing else.',
    'Bill part of it keeps the amount you typed, so two buttons no longer show the same sum.',
    'A stage you bill by its tick box is tied to the bill, so the Pipeline reads it as billed.',
  ],
}

export default note
