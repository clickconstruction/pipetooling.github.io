import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3376',
  date: '2026-09-13',
  title: 'Show it on their statement: share a bill with the other party, one bill at a time',
  kind: 'feature',
  highlights: [
    'Bill Customer’s Send to block has a new line under “Copy …”: Show it on Done Right Foundation’s statement. Tick it and their portal lists the bill in its own card — no Pay button, never in their balance. Copy is the email, once; Show is the statement, standing; they are separate ticks.',
    'On Edit Job → Bill, every bill on a two-party job wears an eye chip — “👁 shown to Done Right Foundation”, or 👁 ▾ when nobody else sees it. Click it to change who sees the bill or hide it again; the portal changes on its next open, and nothing about who pays or who was emailed changes.',
    'The tick starts from the job’s memory: a new Show … row on Edit Job → Edit tab (under Bills also go to) says whether this job’s next bills start ticked. Changing the tick in Bill Customer updates that memory. Bills already sent are never changed by the memory.',
    'The globe modal’s Jobs on this statement strip mirrors shared bills too, tagged shared.',
  ],
}

export default note
