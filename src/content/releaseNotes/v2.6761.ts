import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6761',
  date: '2026-11-08',
  title: 'Banking’s Stripe segment, Ledger, account names, imports and switches, the Contract library’s Forms and Tally’s payroll rules open to the controller',
  kind: 'feature',
  roles: ['dev', 'controller'],
  highlights: [
    'The controller now opens Banking’s Stripe segment and the Ledger tab with its sorting configuration, names the Mercury accounts, imports a bank CSV, keeps the manual accounts and flips the two Accounting switches. Before, these were a dev’s, or a dev’s and the owner’s.',
    'The controller builds the forms people sign on the Contract library’s Forms tab.',
    'The controller writes Tally’s payroll rules, the ones that decide which card charges count as payroll.',
    'Cost batches and Sync and Backfill from Mercury stay a dev’s.',
  ],
}

export default note
