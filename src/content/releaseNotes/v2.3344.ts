import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3344',
  date: '2026-09-11',
  title: 'The Bridge: Vectors — who moved the number this week',
  kind: 'feature',
  highlights: [
    'A new Vectors panel on the Bridge lists one row per person for a pay week: field hours (and hours still waiting on approval), what those hours earned, what they cost, and the contribution left over — with ‹ › to step back through the last eight weeks.',
    'Office and estimating work has its own columns: invoices sent, payments recorded, % reports filed, bids sent and won — so everyone who moved the company line shows up on it, not only the field.',
    'Earned dollars that rest on a job with no % complete are marked ≈ in amber, on the row and the company total, so a guess never reads as a fact.',
  ],
}

export default note
