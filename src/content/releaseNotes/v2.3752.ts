import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3752',
  date: '2026-09-23',
  title: 'Pipeline rows show the next two weeks on the calendar',
  kind: 'feature',
  highlights: [
    'Taunya asked to see when a job is scheduled and when it will be done without opening each one. The cryptic “j: T-1 (wed)” line in the Crew & Dates column is now a two-week strip: ten small cells, this week and next, blue where someone is booked on the job, today outlined. Under it the row says it in words — NEXT Wed Sep 23 · 8–10 AM and ENDS Fri Sep 25 · 3 visits.',
    'A job with nothing booked from today on says so: an amber NOT SCHEDULED flag on a Working job (grey on a Waiting one), the last worked day beside it, and an Assign work… link for planners. A job at 100 % or already past Working reads Done with its last visit instead.',
    'The phone cards get the same strip in their chip row, with “→ Fri Sep 25” when the plan runs past the next visit and a “not scheduled” chip when nothing is booked. Clicking the strip or any line still opens the Job Calendar; the old j: explanation lives on in the hover text.',
    'The strip draws booked days only for now — ticks for the days someone actually worked come next.',
  ],
}

export default note
