import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2842',
  date: '2026-09-05',
  title: 'Subs: Active or on the bench',
  kind: 'feature',
  highlights: [
    'People → Subs has a Status column: Active with "last worked <date>" beneath it, or Bench since <date> with the reason you typed. Pills switch between Active, On the bench, and All.',
    'Bench… sets a sub aside without archiving them. Their portal, sheets, balances, and documents stay put, and Reactivate brings them back in one click.',
    'The app nudges but never moves anyone: an active sub quiet for 90 days gets a Bench… prompt, a benched sub who shows up on a new sheet or accepts a work order gets a Reactivate? prompt.',
  ],
}

export default note
