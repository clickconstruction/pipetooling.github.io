import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4684',
  date: '2026-10-06',
  title: 'Submittals: the GC’s page reads the same four steps as your log',
  kind: 'fix',
  highlights: [
    'The Procurement card on the GC’s review page still counted the old way, so a delivered part was counted as ordered too. It now shows the same four steps as your procurement log: Waiting on you, To order, On order and On site, each part counted once.',
    'Under the steps it carries the same Next line, in their words: Nothing can be ordered until you answer. You sent 5 parts back. 39 more wait on your answer.',
    'The table under it is unchanged: status and dates, never a PO or a house.',
  ],
}

export default note
