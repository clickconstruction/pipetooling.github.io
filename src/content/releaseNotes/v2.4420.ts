import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4420',
  date: '2026-10-02',
  title: 'Call queue: say when to call a GC again, and see what is due today',
  kind: 'feature',
  highlights: [
    'After Left message, Still pending or Rebid / RFQ, pick the day to call again, who to ask for, and what the bid is waiting on. No pick works as before: the bid comes back in seven days.',
    'A bid with a day stays out of the list until that day. It waits under Later, where you can change the date or remove it.',
    'The queue now puts promised calls first. Four pills count your open bids: Due, Overdue, No date yet and Later.',
    'On its day the card is back on top with who to ask for, their number, and what the GC said last time.',
  ],
}

export default note
