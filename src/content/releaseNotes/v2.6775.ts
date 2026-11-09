import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6775',
  date: '2026-11-09',
  title: 'A card dispute that beat its own payment to the office now finds the payment',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'When Stripe reported a card dispute a few milliseconds before it reported the payment, the dispute case opened with no payment on it, and a lost dispute showed the words of Put the bill back with no press.',
    'The next word from Stripe on that dispute now finds the bill’s payment and puts it on the case, so Put the bill back appears and does its four things: the payment comes off, the bill returns to Ready to Bill, the job leaves Paid, the case closes.',
  ],
}

export default note
