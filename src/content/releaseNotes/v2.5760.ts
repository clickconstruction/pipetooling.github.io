import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5760',
  date: '2026-10-22',
  title: 'Legal Desk: write an account down in one place, and see what each bill becomes',
  kind: 'feature',
  highlights: [
    'Write it down… sits beside Mark attorney ready and opens a panel under the header. It asks How much will we accept? for the whole account, with a slider, a % box and a $ box that move together, and shows the split across the account’s open bills: what each owes, what we accept, what we forgive, and what each still owes after.',
    'The button says exactly what it will do, such as Write down $811.22 across 2 bills, and stays off until a note of what was agreed is in. Each bill is written down one at a time; a bill the write-down refuses is listed with the reason, and the rest still go.',
    'The old Write down… door, which opened a per-bill discount window on one bill without saying which, is gone from the desk; the checklist’s write-down fix opens the panel too.',
  ],
}

export default note
