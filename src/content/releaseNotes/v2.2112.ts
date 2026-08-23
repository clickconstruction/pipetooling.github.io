import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2112',
  date: '2026-08-22',
  title: 'Partner ledger weeks: the lines add up to the penny',
  kind: 'fix',
  highlights: [
    'On a few weeks the labor lines on your ledger card summed to one cent off the week\'s closing number. The lines now reconcile to the posted amount, so Week opened + the lines = Week closed on every card, exactly.',
    'Rates read as money: "× $37.50" instead of "× $37.5".',
    'Past weeks that only carry charges (no statement was issued) now say so in place of the Print / Acknowledge buttons.',
  ],
}

export default note
