import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6892',
  date: '2026-11-10',
  title: 'Permits: find a permit on any list, in any city',
  kind: 'feature',
  highlights: [
    'A magnifier at the start of the Permits strip opens Find a permit. Type a street, a permit number, a project, a builder or a city. It searches Skim, Investigating, Pursuing and Closed in all five cities at once.',
    'Each result says where the permit sits now and the last thing done to it, such as \u201cSam passed, Nov 9: too far\u201d. Press its name to open it.',
    'A passed permit can be sent to Investigate or put back on the skim straight from its result.',
    'Closed has a new On a map switch. It shows every permit on the chip as a pin, however old, where the Ledger\u2019s map stops at 90 days.',
  ],
}

export default note
