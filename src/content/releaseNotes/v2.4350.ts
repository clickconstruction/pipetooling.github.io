import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4350',
  date: '2026-10-01',
  title: 'Clock in: no more "Lock was stolen" when the app opens',
  kind: 'fix',
  highlights: [
    'When the app is busy renewing your sign-in as it opens, a screen that could not load tries again by itself instead of showing an error.',
    'If the clock button still cannot load, it says so in plain words with a Try again button, and it loads again on its own when you come back to the app.',
  ],
}

export default note
