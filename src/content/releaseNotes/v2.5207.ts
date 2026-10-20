import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5207',
  date: '2026-10-10',
  title: 'GC mode: what a customer owes us, in their window',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A GC customer’s window now shows what they owe us across all their jobs, what they hold and the interest on late bills.',
    'Documents lists each job’s pay applications, late bills, interest bills and change orders after our contract.',
    'Each row opens the bill or the change orders, and our contract’s file opens from its row.',
    'Each job reads its own retainage and days to pay, so the numbers match Bill the customer.',
  ],
}

export default note
