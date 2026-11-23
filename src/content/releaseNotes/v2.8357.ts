import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8357',
  date: '2026-11-23',
  title: 'Working hours: a dev or the controller sets the usual workday',
  kind: 'feature',
  highlights: [
    'The usual day in the Workday schedule window is now set by a dev or the controller, as working hours are. Everyone else sees it there with its fields off.',
    'A custom schedule for one date is unchanged. A salaried person still moves their own day, and pay staff still correct a date.',
    'Hire asks a dev or the controller for a salaried hire\'s workday start. For anyone else it saves no workday and says who sets the hours.',
  ],
}

export default note
