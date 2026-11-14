import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7239',
  date: '2026-11-13',
  title: 'Subs Ledger: match a payment to the bank line it left on',
  kind: 'feature',
  highlights: [
    'Find bank lines, on the Subs Ledger by date, reads the money that left Mercury in the period.',
    'A payment gets a picker when a bank line fits: the same amount, within three days. Choose the line and the payment is matched and ticked in one press.',
    'A matched payment shows the bank line\'s day and payee. "undo" takes the match off, and its tick with it.',
    'One check that paid several sheets is matched as one. Nothing is matched without a press.',
  ],
}

export default note
