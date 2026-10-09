import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5035',
  date: '2026-10-09',
  title: 'Supply houses: a credit says which invoice it credits',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The credit form has Credits invoice…, a list of the house’s invoices to pick the one the credit takes money off.',
    'Both rows then name each other: the credit reads Credits S123148787.003, and the invoice reads Credited by with the credit’s number and amount.',
    'A credit pairs only to an invoice from the same house.',
  ],
}

export default note
