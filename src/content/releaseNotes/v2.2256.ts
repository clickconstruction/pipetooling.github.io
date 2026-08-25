import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2256',
  date: '2026-08-24',
  title: 'Billing system-of-record policy written down',
  kind: 'infra',
  highlights: [
    'The rules from the billing data-quality push are now documented: the app is the system of record, HCP history repairs only flow through the Settings importer, and payment-date trust ranks bank > Stripe > HCP report > hand-entered.',
  ],
}

export default note
