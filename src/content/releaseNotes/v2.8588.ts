import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8588',
  date: '2026-11-25',
  title: 'Accounts Receivable: the office can reopen a case it closed',
  kind: 'feature',
  highlights: [
    'A developer, a master, an assistant and a controller now see Closed cases at the top of the list. Until now a developer alone saw it, for test cases.',
    'Reopen… works on a case of any job that was closed as settled another way or as not coming. The case goes back under Came back and stands open until someone closes it again.',
    'The list shows the cases closed in the last 90 days, newest first. One press shows the older ones.',
    'A case closed by a new payment or by Stripe’s answer stays closed. The list counts those and does not show them.',
  ],
}

export default note
