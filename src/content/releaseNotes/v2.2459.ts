import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2459',
  date: '2026-08-28',
  title: 'Hiring board: duplicates flagged, contact debt visible',
  kind: 'feature',
  highlights: [
    'Two cards with the same phone or email in one role column now get a red "duplicate of #N" flag with one-tap Merge — notes, links, and screening reviews move to the kept card and the copy is deleted.',
    'A candidate sitting in several role columns shows an "also in:" chip on each card, so cross-role candidacy is visible instead of silent.',
    'Every role column shows how many of its candidates have never been contacted, and the top-ranked uncontacted card wears a "call next" nudge.',
  ],
}

export default note
