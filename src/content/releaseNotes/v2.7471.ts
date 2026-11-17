import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7471',
  date: '2026-11-16',
  title: 'Supply houses: the bank agrees with a payment, and a bank line opens Record a payment',
  kind: 'feature',
  highlights: [
    'A supply house payment is offered the bank line for the same money. Press Match and the payment reads "Bank agrees", so the day and the amount are checked against the bank.',
    'On the finish-later list, Use this line fills the day and how it was sent from the bank line in one press.',
    'Accounts payable lists bank lines to supply houses that have no payment recorded. Say what it paid opens Record a payment with the amount, the day and the method filled.',
    'Both card and ACH payments are in the bank feed. A house paid some other way gets no offer, and its payments stay typed.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
