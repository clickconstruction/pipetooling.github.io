import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5216',
  date: '2026-10-10',
  title: 'The Bridge opens on the number we maximize: field contribution per week',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'The top of the Bridge is this week’s field contribution on recorded time, with the approved figure under it and the last eight pay weeks as bars.',
    'A week still waiting on approvals is hatched and marked ≈, and the verdict sentence says when a low week is the approval pile, not the field.',
    'The two constraints sit under it as lights: net position rises over eight weeks, and cash stays above the floor, each with its one-line reason.',
  ],
}

export default note
