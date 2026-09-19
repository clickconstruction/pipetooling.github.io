import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3607',
  date: '2026-09-18',
  title: "People → Who's where: the day as floating heads on job islands, with a time-of-day scrubber",
  kind: 'feature',
  highlights: [
    "A new People view, Who's where: one island per job and a head for every person who was there at the moment under the slider. Solid heads are clocked in; hollow heads are listed on the schedule but not clocked in anywhere. The ring says the role.",
    'Step days with the arrows or the week strip (each day shows its head count), drag the slider through the day, or press play and watch the day walk itself. A link keeps the day.',
    'Under the islands, the day as lanes — a bar per person per job — with the plan and the clock side by side: a dashed bar nobody clocked reads "never clocked" or "clocked at" the job they went to instead.',
    'Nothing on the page is typed and nothing is written; it is what the day looked like. Every office role can open it; assistants see the same window of days the Hours tab gives them.',
  ],
}

export default note
