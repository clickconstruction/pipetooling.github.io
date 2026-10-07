import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4777',
  date: '2026-10-07',
  title: 'GC mode: the rules that keep the schedule true move into the app',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The rules that keep a GC mode schedule true move from the prototype into the app, word for word: the weekly walk, schedules nobody walked, what the work waits on, the daily log against the chart, days lost, the finish outlook, a trade’s crew count, people on site, the morning list, a trade’s late notice and too many trades in one place.',
    'They are tested on the prototype’s own made-up job, so the app gives the answers the owner tried.',
    'Nothing on a screen reads them yet. Telling the trades and the customer’s schedule come next in the GC mode real build.',
  ],
}

export default note
