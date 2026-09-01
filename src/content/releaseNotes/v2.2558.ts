import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2558',
  date: '2026-08-31',
  kind: 'feature',
  title: 'Job Mode: your whole day on the card — and a real Clock Out',
  highlights: [
    'The Job Mode card now shows today’s day rail: every scheduled job with a ✓ when it’s done, a green ring on where you are now, and an amber "still open" flag on anything you drove past. Tap any open job to jump straight to it.',
    '"Next Job" got smarter: it skips jobs you’ve already visited and wraps back to the ones you skipped, and the switch sheet lets you pick a different destination — or "Done for the day" — right there.',
    'Clocking out no longer means hunting through the full dashboard: your last open job shows a red "Wrap Up Day" button, and a small "Clock out" link under the buttons covers lunch breaks and early outs any time.',
  ],
}

export default note
