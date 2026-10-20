import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5164',
  date: '2026-10-10',
  title: 'GC mode: the schedule shows change orders and asks for the days',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A signed change order’s days show on the schedule, as a tail on the bar it moves.',
    'The projected finish says whose late days they are when the job runs past the contract.',
    'The money team can press Ask for the days. It drafts a change order on Bill the customer, and nothing goes to the customer.',
  ],
}

export default note
