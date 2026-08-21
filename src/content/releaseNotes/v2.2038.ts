import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2038',
  date: '2026-08-21',
  kind: 'feature',
  title: 'Customer statement: HVAC in the tagline, days since billed',
  highlights: [
    'The customer portal\'s letterhead now reads "Plumbing, Electrical, and HVAC" under the CLICK. wordmark, and the partner weekly statement print header matches.',
    'The letterhead\'s right-side line becomes "Your reliable team is just a click away" (was "San Antonio, Texas").',
    'Every bill on the statement now shows its age under the billed date — "today", "yesterday", "46 days ago" — turning quietly copper once a bill crosses 30 days.',
  ],
}

export default note
