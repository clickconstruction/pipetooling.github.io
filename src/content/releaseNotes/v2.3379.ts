import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3379',
  date: '2026-09-13',
  title: 'Accounts Receivable: the header counts the pile and every deposit says what we already know about it',
  kind: 'feature',
  highlights: [
    'The header now reads “4 deposits to match · $9,115.42 unapplied” instead of a paragraph of instructions (they live in the help guide). Mark returned deposits and the dev-only Mercury filter moved under a ⋯ button.',
    'Every deposit row wears a chip: 1 exact match · probably recorded · same amount, several bills · payer known · applied · returned — the same reads the modal used to keep for the right pane.',
    'The list is called Deposits, and a To match · All switch replaces the “Show fully applied and returned deposits” checkbox. Rows show the date, the kind badge and the first line of the memo.',
  ],
}

export default note
