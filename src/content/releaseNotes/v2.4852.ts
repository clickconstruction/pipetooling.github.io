import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4852',
  date: '2026-10-07',
  title: 'Lien notices: the enclosed invoice names the bill the customer saw',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The invoice enclosed with a § 53.056 notice now prints the number and due date Stripe put on the bill, the same ones the customer has. Before, a job’s first bill printed as Invoice #0 with the send day as its due date.',
    'The same number is on the enclosure’s heading, the pay page and the preview, so the notice, its enclosure and the pay page all name one bill.',
    'The check-mailing note under a bill is no longer printed as the bill’s Scope when the bill has a real line.',
  ],
}

export default note
