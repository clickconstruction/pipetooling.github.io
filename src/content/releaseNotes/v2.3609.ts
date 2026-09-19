import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3609',
  date: '2026-09-19',
  title: "People → Who's where: the week as crews — who worked with whom, the lead read off the schedule",
  kind: 'feature',
  highlights: [
    "Who's where now opens on the week: one card per crew — the people who were on a job together — with days-together under each head and the jobs the crew touched underneath. Step weeks with the arrows; tap a day in the strip to drop into that day's islands.",
    'The crown is the crew\'s lead — the master on the crew, else the subcontractor — read off the schedule and the clock for the week, never set by anyone. A crew with neither says "no lead listed", the cue to put the master on the block.',
    'Where Dispatch\'s plan and the clock disagree, the head says so: "listed 3 · clocked 1", or "1 day on another job". Masters, who do not clock, show as hollow heads with their listed days.',
    'The side box holds Office, Alone this week, and a count of who was not in. Nothing on the page is typed and nothing is written — the Team leads list is untouched.',
  ],
}

export default note
