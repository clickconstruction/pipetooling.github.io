import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4309',
  date: '2026-10-01',
  title: 'Edit Job → Bill: each bill reads on one line, and its waiver row waits its turn',
  kind: 'feature',
  highlights: [
    'Who a bill went to and what is still open read as one line, with Record payment at its end.',
    'On a GC job the lien waiver chips sit on their own line at the right, with the bill’s ⋯ at the end.',
    'The chips stay grey until a waiver on that bill is under way. Amber now means a step is yours.',
    'On a touch screen every bill button is big enough for a thumb.',
  ],
}

export default note
