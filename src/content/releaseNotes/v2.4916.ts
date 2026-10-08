import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4916',
  date: '2026-10-08',
  title: 'GC mode: a trade partner’s portal link reads its own asks',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A trade partner company’s portal link now reads that company’s asks, quotes, plans, questions, people and the emails we sent it, and nothing else.',
    'It never carries our price to the customer, our budgets or fee, another company or the office’s notes.',
    'A made-up sample company answers the sample link, so the portal can be shown without a real company. The portal page itself comes next in the GC mode real build.',
  ],
}

export default note
