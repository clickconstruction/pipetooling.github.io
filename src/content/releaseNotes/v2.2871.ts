import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2871',
  date: '2026-09-05',
  title: 'Sub Labor: the same row as Work Orders, with the rail on it',
  kind: 'feature',
  highlights: [
    'Jobs → Sub Labor now carries the Work Orders spine: Agreed · Paid · Due, then Where it stands — the rail the sub sees on their portal (Work · Walk-through · Customer pays · Paid) with the office\'s Drafted · Sent · Signed in front of it. A dashed red run means work is happening with nothing signed, and the Due figure turns the same red.',
    'Next names the office\'s move on every row — Get it in writing (with Draft a work order… right there), Price it and send, Waiting on the sub, Wait for "done", Schedule the walk-through, Bill and collect, Pay the sub. The stage menu now lives on the rail\'s current dot; → beside it still advances one step.',
    'Crew pay sheets (a teammate on the sheet) wear a Crew pay label and draw only the four sub dots — they never need a work order. Two new filters: No agreement and Subs only. Rows sort by money due by default; Date and Contractor are still there.',
  ],
}

export default note
