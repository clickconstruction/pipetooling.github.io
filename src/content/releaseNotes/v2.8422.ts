import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8422',
  date: '2026-11-23',
  title: 'Bills sent: a check shows its number, never a long code',
  kind: 'fix',
  highlights: [
    'A check matched to a bank deposit no longer shows a 36-character code where its number belongs. It reads Check · bank deposit.',
    'A check whose number was typed still shows it, like Check 4417. A number typed as ck# 3045 reads Check 3045.',
    'The fix covers both views of Bills sent, a bill’s record, the printed pages and the spreadsheet files.',
  ],
}

export default note
