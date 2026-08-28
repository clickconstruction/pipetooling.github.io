import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2470',
  date: '2026-08-28',
  title: 'GCs sign — or decline — right in the bid room',
  kind: 'feature',
  highlights: [
    'The bid room now takes signatures: the GC picks the base or an alternate, types their name, and the Approve button says exactly what they\'re committing to.',
    'A signature marks that GC\'s packet Won automatically — and other sent, unanswered packets Lost, the same rule as marking a win by hand. You get an email the moment it happens.',
    'A GC who passes can tell you why — price, another sub, project died — straight into Why we lost, in their own words.',
    'Signing always applies to the current revision — an update published while their page was open shows them the new version instead of a stale number. The signed record files into the Estimates Ledger with a "Bid ✍" chip linking back to the bid.',
  ],
}

export default note
