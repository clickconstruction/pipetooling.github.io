import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4760',
  date: '2026-10-07',
  title: 'Pipeline on a phone: a bill\'s card says when it was billed, not when it was last sent',
  kind: 'fix',
  highlights: [
    'On the phone board a Billed or Collections card reads billed from the day the bill went out, the same day the computer\'s dates block shows.',
    'Before, a bill resent after a returned check read billed 5 weeks ago on the phone while the computer said 144 days.',
    'A working job\'s progress bill and a job with no bill line still read their latest billing event.',
  ],
}

export default note
