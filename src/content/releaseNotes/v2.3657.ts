import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3657',
  date: '2026-09-20',
  title: 'Lien desk: the four gates are numbered steps under a plain headline — Can’t go out yet, or Ready to go out',
  kind: 'feature',
  highlights: [
    'The gates are no longer a row of small chips that wrapped differently on every job. Each has its own numbered place — 1 owner of record, 2 original contractor, 3 property kind, 4 approved hours — in one row across a wide pane and stacked 1 to 4 in a narrow one.',
    'The headline says whether the notice can go, and the count says why: “1 blocker · 1 to check” instead of “2 of 4”. Only what actually stops the send is red; an unknown property kind is amber, because it moves the deadline but does not hold the notice.',
    'What to do about a gate sits right under it with the same number — the roll’s owner with Use and Find the owner under 1, Set property kind under 3 — and a job with no GC or no month ticked now says so in its gate.',
    'The strip that stays pinned while you read the notice carries the same headline.',
  ],
}

export default note
