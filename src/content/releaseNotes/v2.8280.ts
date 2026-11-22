import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8280',
  date: '2026-11-21',
  title: 'The Bridge: a ZZ test estimate is no ask on Market and in no list on Sales',
  kind: 'fix',
  highlights: [
    'A ZZ test estimate no longer counts as an ask on the Bridge. It left the won rate earlier and stayed in the asks.',
    'It also leaves the estimates sent, won, lost and still out, and the lists inside the Market and Sales windows.',
    'This is for anyone who hides ZZ tests, which is everyone but a dev who chose to show them. That dev keeps every test estimate.',
    'No real estimate moves. Today one test estimate is in the window: a $200 one, sent and declined on November 18.',
  ],
}

export default note
