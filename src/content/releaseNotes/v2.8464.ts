import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8464',
  date: '2026-11-24',
  title: 'On a phone, Undo and a bid window’s ✕ are easier to tap',
  kind: 'fix',
  highlights: [
    'On a phone, Undo on the note at the bottom of the screen now stands 44 px tall, the height a thumb needs. It was 26 px, on a note that leaves by itself in ten seconds. The × beside it is a 44 px square. The note is no taller than it was.',
    'In a bid’s window on a phone, Copy for text, Edit bid and the ✕ stand 44 px tall, and the ✕ is as wide. They were 33 px.',
    'On a computer everything looks as it did.',
    'For developers: a frame on Settings → What everyone sees stays on its page when the app reloads onto a new build. It used to come back on the person’s home page.',
  ],
}

export default note
