import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8700',
  date: '2026-11-27',
  title: 'Trade portal: every press stands a fingertip tall on a phone',
  kind: 'fix',
  highlights: [
    'A trade partner opens their portal from an email, most often on a phone. Its buttons stood about 30 px tall there, and its links 15 to 20.',
    'On a phone every button, link, tick, pick list and field of the portal now stands 44 px tall, the height a thumb needs.',
    'The portal’s pages are a little longer on a phone for it. Nothing wraps onto a new line.',
    'Nothing changes on a wider screen, and nothing changes on the office’s own GC pages.',
  ],
}

export default note
