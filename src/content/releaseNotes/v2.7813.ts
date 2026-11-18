import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7813',
  date: '2026-11-18',
  title: "People: the buttons on a person's sheet all read as live",
  kind: 'fix',
  highlights: [
    'Imitate and the three dot menu were drawn pale beside Day · week · month and Email, so they looked switched off. All four now share one look.',
    'The three dot menu sits at the right edge of the row and opens under itself.',
    'Imitate is left off a person whose login is not attached yet. Pressing it there did nothing.',
  ],
}

export default note
