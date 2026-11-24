import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8513',
  date: '2026-11-24',
  title: 'Hard Reload asks first when you have typed words',
  kind: 'fix',
  highlights: [
    'Hard Reload in the gear menu clears words you typed and have not sent. It now asks first when the page holds such words.',
    'The app takes you to each place you typed and rings it in orange for a second. Then a small bar offers Reload anyway and Not now.',
    'Reload on a page that could not load asks the same way.',
    'With nothing typed, both presses reload at once, as before.',
  ],
}

export default note
