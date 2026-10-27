import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5954',
  date: '2026-10-26',
  title: 'A check that keeps evening times on the right day',
  kind: 'infra',
  highlights: [
    'Behind the scenes, a check now stops new code from reading an evening time as the next day. That kind of slip showed an evening call or payment under tomorrow’s date.',
  ],
}

export default note
