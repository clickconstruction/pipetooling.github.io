import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2983',
  date: '2026-09-06',
  title: 'Safety net under the Stripe invoice footer',
  kind: 'infra',
  highlights: [
    'Nothing changes in the app. The footer on every Stripe invoice — the plumbing and electrical presets, the org-wide overrides and how they reach each device — plus the invoice-details reader and the pay-link email and text now have 25 tests pinning their behaviour, including one that fails if the client and server ever disagree on the footer length limit.',
  ],
}

export default note
