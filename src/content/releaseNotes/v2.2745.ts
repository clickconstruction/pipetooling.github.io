import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2745',
  date: '2026-09-03',
  title: 'Timeline — Color by state on the day, or by run length',
  kind: 'feature',
  highlights: [
    'Jobs → Job Summary → Timeline has a Color by control: status today (as before), state on the day, or run length. The counts don\'t change; only how the stack is painted.',
    'State on the day colors each day of a job by where it stood then — blue until its bill went out, orange until it was paid, green after — so a job paid last week no longer paints June green. The bars panel splits each bar at the same moves.',
    'Run length colors by how long the job ran (6+ days at the bottom, 2–5, then 1-day jobs on top), so the long-running carry and the service-call churn read as different colors without leaving the chart. The choice is remembered per device.',
  ],
}

export default note
