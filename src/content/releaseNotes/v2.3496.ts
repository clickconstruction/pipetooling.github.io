import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3496',
  date: '2026-09-16',
  title: 'Accounts Receivable: when a customer pays more than their bills, record the difference as a tip on the job',
  kind: 'feature',
  highlights: [
    'A deposit that has paid its bills but still has money on it now shows a strip saying so — "$50.00 more than the bills. They paid over. Record it as a tip on 960 · Elaine Giesber-Installations." One button adds a Tip line to that job and records the leftover as a payment, and the deposit leaves the To match list on its own.',
    'There is nothing to type. The tip is the difference. When every bill on the deposit sits on one job there is nothing to pick either; when a deposit covers two jobs, a short list of those jobs appears so you can say which one earned it.',
    'The tip becomes real revenue on the job, the same way tips imported from HouseCall Pro are already recorded, so it reaches Job Summary and the crew\'s numbers. It attaches to the job rather than to any one bill, so no invoice reads as overpaid.',
    'The button asks once before it writes, because taking a tip back later means removing two things in Edit Job. Recording it also sends the usual internal "payment recorded" notice to the office — nothing goes to the customer.',
  ],
}

export default note
