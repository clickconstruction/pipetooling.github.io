import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7168',
  date: '2026-11-13',
  title: 'Subs pay: the three dots sit in the middle of their button',
  kind: 'fix',
  highlights: [
    'On Jobs, Subs, Pay, each sheet has a small button with three dots at the end of its row. The dots sat low and to the right, almost on the button\'s edge.',
    'The dots now sit in the exact middle of the button, on a short row and on a tall one, in light and in dark.',
    'The same button beside a payment on a job\'s Bill tab had the same fault and is fixed too.',
    'Both buttons are the same size and open the same menu as before.',
  ],
}

export default note
