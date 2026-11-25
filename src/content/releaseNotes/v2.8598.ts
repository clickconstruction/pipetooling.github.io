import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8598',
  date: '2026-11-25',
  title: 'When the app was busy renewing your sign-in: plain words and a Retry',
  kind: 'fix',
  highlights: [
    'Settings could open as one red line of raw words, AbortError: Lock was stolen by another request, with nothing to press. It now says the app was busy renewing your sign-in, with a Retry.',
    'Every screen that shows those words on its retry line now offers Retry with them. Before, the words ended Try again and gave no press.',
    'Two other reads on Settings, the team list and the daily goals, now say their failure in plain words too.',
  ],
}

export default note
