import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7459',
  date: '2026-11-16',
  title: 'Supply houses: pay part of a bill, use a credit memo, keep money on account',
  kind: 'feature',
  highlights: [
    'In Record a payment each ticked bill has its own box. Lower it to pay part of the bill. The bill stays unpaid and its row reads what was paid and what is left.',
    'An open credit memo is a line to tick. It lowers the amount sent, the way the house nets it on a statement, and then reads used.',
    'Money sent past the bills can be kept on account with the house. The house\'s card shows it, and the next payment offers it first.',
    'A bill paid in part now counts for what is left on it in the aging table, on Held for suppliers, on the phone screen, in the Accounts payable total and on the Lien desk.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
