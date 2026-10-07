import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4781',
  date: '2026-10-07',
  title: 'GC mode: telling the trades, the customer’s schedule and the schedule’s files move into the app',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The rest of the GC mode schedule’s rules move from the prototype into the app, word for word: telling the trades their new dates, the trade’s own chart, the customer’s schedule and its sends, the rough schedule while we bid, templates, drawing a schedule from another company’s file, their dates to meet, and the export and the print.',
    'They are tested on the prototype’s own made-up job, so the app gives the answers the owner tried.',
    'Nothing on a screen reads them yet. The schedule’s tables come next in the GC mode real build.',
  ],
}

export default note
