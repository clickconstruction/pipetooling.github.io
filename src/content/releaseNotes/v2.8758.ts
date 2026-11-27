import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8758',
  date: '2026-11-27',
  title: 'The Training card: each button says which course it starts',
  kind: 'fix',
  highlights: [
    'On the Dashboard’s Training card every course has its own button, and several can read Start.',
    'A screen reader now says the course with it, such as “Start Intro to HVAC”, so each one can be told apart.',
    'Nothing on the screen looks different.',
  ],
}

export default note
