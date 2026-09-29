import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4177',
  date: '2026-09-29',
  title: 'What the team sees: the one-day Dispatch schedule renders live',
  kind: 'feature',
  highlights: [
    'Settings → What the team sees opens the Dispatch schedule email on a sample day — four blocks, who is where and when, the addresses and notes — as the morning email lays it out.',
    'The email is unchanged: its builder moved out of the function into a shared kernel the browser can run.',
    'Twenty of the twenty-five team emails render live; five to go.',
  ],
}

export default note
