import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3252',
  date: '2026-09-10',
  title: 'Discounts as line items — the groundwork',
  kind: 'infra',
  highlights: [
    'Jobs can now carry a discount row in their line items: a percent that stays live as prices change, or a fixed dollar amount, applied to all of the work or to chosen lines.',
    'A discount follows the work it applies to — every draw that bills those lines carries its share, split to the cent — and it can never take the Job Total below zero.',
    'Nothing changes on screen yet: this release lays the database and the math. The row itself, the customer-facing bill line, and the activity trail arrive in the next releases.',
  ],
}

export default note
