import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4274',
  date: '2026-09-30',
  title: 'Accounts Receivable: every deposit row says where it went',
  kind: 'feature',
  highlights: [
    'Under each deposit in Accounts Receivable, one line reads its trail: which job and bill it was applied to, when, and by whom — “→ #650 ATI Schertz today 4:02 PM by Taunya · was #878 Take 5- Seguin 9/29”.',
    'A cheque that was taken off a bill and put back in To match says where it was and who took it off, so it never looks like new money. A cheque the bank returned reads the bounce and the day it came off the bill.',
    'A move reads as a move: where it is now, then where it was. Rows applied with nobody signed in say “by the app”.',
  ],
}

export default note
