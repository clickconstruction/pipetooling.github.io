import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1913',
  date: '2026-08-20',
  title: 'Roadmap gets a Plan view built for handing out work',
  kind: 'feature',
  highlights: [
    'A new Map/Plan toggle on the Roadmap: Plan lays the whole tree out as a flat list — what’s open now, what each stage feeds, what’s locked and why, and big goals with progress bars.',
    'Staffing is now tap-tap: open a stage, pick a name once, tap tasks to hand them out — each one lands on that person’s Today list immediately.',
    'The header tells the truth at a glance: tasks done, tasks assigned, and how many still have nobody on them.',
    'Fixed a trap where goal stages with no tasks of their own could never count as done, permanently locking everything behind them — they now complete when the stages feeding them do.',
  ],
}

export default note
