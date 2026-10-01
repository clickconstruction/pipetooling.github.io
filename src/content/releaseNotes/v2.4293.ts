import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4293',
  date: '2026-10-01',
  title: 'Edit Job → Bill: each bill shows the money that paid it',
  kind: 'feature',
  highlights: [
    'On the Bill tab every bill now lists the payments counted toward it, one line each, under a thin bar that shows how much of the bill is in. A line reads the amount, the day it came, where it came from, and how many days after the bill went out.',
    'A bank deposit names who paid, the way the bank saw it: “check from Loberg Contracting”. The bank’s reference number no longer prints.',
    'The rare doors moved into a ⋯ menu on each line: the check date, Move to job…, Unlink and remove, Undo part payment, Check didn’t clear…, and Edit details for a payment typed by hand.',
    '③ is now “Other money on the job”: a payment on no bill, a payment still being typed, and the Record a cash or check payment button. A payment on the job with no bill picked shows under the oldest open bill with a “no bill picked” tag and a Pin it to this bill link.',
  ],
}

export default note
