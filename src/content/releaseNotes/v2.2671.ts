import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2671',
  date: '2026-09-03',
  title: 'Stale time approvals now show up on your Dashboard',
  kind: 'feature',
  highlights: [
    'When clock sessions sit unapproved for 3+ days, a "Needs you" item appears with the count, the hours, and how old the oldest one is — one tap opens the approvals queue on People → Hours.',
    'It only speaks up when the queue is actually stale: a normal same-week pile never nags.',
    'Why it matters: unapproved time is invisible to payroll, the Hours grid, and the Overhead numbers — this keeps a stalled queue from quietly skewing all three.',
  ],
}

export default note
