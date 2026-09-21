import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3678',
  date: '2026-09-21',
  title: 'Quick time add: the call that ran past midnight can still be added',
  kind: 'fix',
  highlights: [
    'Quick time used to be for today only, so a call that ran 11:54 pm to 12:04 am could not be added at 12:05 — its start was yesterday — and neither could one that ended at 11:50 pm. Both were sent to My Time.',
    'Now a quick add is taken when it is today\'s, or when it ended within the last two hours, whichever day it touched. The line under the sheet says "last night" instead of "today" when the call started before midnight, and the entry lands on the day it started, like a clock punch.',
    'Nothing else changes: still 5 to 30 minutes, still a sentence, still never in the future, still never over hours you already have.',
  ],
}

export default note
