import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3308',
  date: '2026-09-11',
  title: 'Customers can pay by bank transfer or mailed check from their statement',
  kind: 'feature',
  highlights: [
    'A customer\'s statement page now carries "Prefer to pay by bank transfer?" under Total due — collapsed until tapped, then the routing and account number with Copy buttons, the memo to write so the deposit matches on its own, where checks must be mailed (and that checks sent elsewhere may need to be re-issued), and the line that defends against fake "new bank details" emails.',
    'Accounts Receivable has a 🏦 Bank transfer details button in its header, so the office can read or copy the same details while a customer is on the phone.',
    'The details are entered once at Settings → Company → Bank transfer details (master or dev) and stored in the database only — never in the app\'s source. A typo in the routing number is caught before it saves; a checkbox turns the statement card off without clearing anything.',
  ],
}

export default note
