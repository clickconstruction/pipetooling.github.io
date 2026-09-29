import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4075',
  date: '2026-09-28',
  title: 'Cover Letter: the schedule of values can split each stage into labor and material',
  kind: 'feature',
  highlights: [
    'Under the Schedule of values pill, tick Split labor and material: each stage’s value divides into labor and material by the ratio of the bid’s own costs — the Labor tab’s hours times the rate plus subcontractors, against the takeoff’s material times the factor. Nothing to type; the letter, the Approval PDF and the printed schedule all carry both figures.',
    'Either figure can be typed over (the stage still adds up) with a reset back to the bid’s costs, and every stage takes a note for the GC that prints under its line.',
    'A stage with no cost on either side takes the company labor share (Settings → Bid Cover Letter Defaults, 45% unless you change it) and says so.',
    'Letter shows the total only keeps the proposal to one line pointing at the attached schedule, so the split lives on the sheet headed “for progress billing only”.',
  ],
}

export default note
