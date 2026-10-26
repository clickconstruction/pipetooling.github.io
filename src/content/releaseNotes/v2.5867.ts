import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5867',
  date: '2026-10-25',
  title: 'The Bridge: badges out of the buttons, and "reading…" while the cards load',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'The stage and resource cards\' badges were buttons inside buttons — invalid markup a screen reader read as part of the card. The badge is now its own control beside the card\'s press.',
    'Market and Sales say "reading…" while their loader is in flight, instead of a few seconds of "not readable yet" on every load; the error line shows only on failure.',
  ],
}

export default note
