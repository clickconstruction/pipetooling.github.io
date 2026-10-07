import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4884',
  date: '2026-10-07',
  title: 'Help: the billing guides match the Bill tab again',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Making a Stripe bill, sending it and choosing who gets the bill now follow the Bill tab as it is today.',
    'The sub ledger guide names the pay-run setting, the Pay when chips and the row menus as the screen prints them.',
    'The bank feed and Pipeline sort guides point to the Costs tab and list all four sort orders.',
  ],
}

export default note
