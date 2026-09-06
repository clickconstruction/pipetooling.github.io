import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2929',
  date: '2026-09-06',
  title: 'Dispatch sees the subs',
  kind: 'feature',
  highlights: [
    'Schedule → Dispatch → People gains a read-only Subs section under the crew: one row per sub, a solid chip on the days they picked, a striped chip where a window is set but not picked, a dashed one while an offer is still out. A chip opens the job. Nothing here is a schedule block — the work order\'s dates are the schedule.',
    'Crew members assigned to a job see a small "sub" badge on the days a sub is definitely on it, with the names on hover. Windows never badge — only picks do.',
    'The Day tab shows "Subs on site" above the crew, with "Add a site visit ›" that arms place-a-job for that job so a real block lands on a superintendent\'s lane.',
    'The Crew Day email ends with "Subs on site today" — who, which stage, which job, which days.',
  ],
}

export default note
