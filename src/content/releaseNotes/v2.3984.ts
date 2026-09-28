import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3984',
  date: '2026-09-27',
  title: 'Draft Payroll: the waiting-for-approval count has tests',
  kind: 'fix',
  highlights: [
    'The count of clock sessions still waiting for approval, shown at the top of Draft Payroll, is its own tested piece: it clears when the window closes, and a slow older count never lands on top of a newer one.',
    'Nothing on screen changes.',
  ],
}

export default note
