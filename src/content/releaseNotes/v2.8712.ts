import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8712',
  date: '2026-11-27',
  title: 'The “Back online” line stops saying it is trying once its try is over',
  kind: 'fix',
  highlights: [
    'When the signal comes back, a screen that only shows you things tries once more by itself and says “Back online — trying again…”.',
    'If that one try did not load the screen, the line kept saying it was trying while nothing was being tried.',
    'After eight seconds it now reads “Back online, but this did not load. Tap Retry to try again.”',
    'If the signal drops and comes back again, the screen tries by itself again.',
  ],
}

export default note
