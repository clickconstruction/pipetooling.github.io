import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2602',
  date: '2026-09-01',
  title: 'Crew Day: what everyone did today, on one card',
  kind: 'feature',
  highlights: [
    'A new Crew Day section on the Dashboard shows each person\'s day: the jobs they were on, scheduled vs actual clock times, hours, the field reports they left, and how far the job moved.',
    'Attention flags do the scanning for you — "No report left", "Scheduled — never clocked in", and "Unscheduled work".',
    'Step back through previous days with the arrows. Office roles see the whole company; superintendents see the crews on their assigned projects.',
    'Hours only — no wages or money anywhere on the card.',
  ],
}

export default note
