import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4431',
  date: '2026-10-02',
  title: 'Windows: the bottom row is never under the Dispatch or Job mode bar',
  kind: 'fix',
  highlights: [
    'In Dispatch Mode or Job Mode, a window that filled the height of the screen had its last row under the bar at the foot of the screen. That row is usually Save. On a short laptop window or a phone you could not reach it.',
    'Every window now opens over the bar. This covers more than 250 windows, among them GC Review, call mode, Add vehicle, the price book and the customer tools.',
    'Windows still open over each other in the same order. A job opened from GC Review still opens on top of it.',
    'The Follow-Up deck and a person\'s hours page on a phone keep the bar, as before. They leave room for it.',
  ],
}

export default note
