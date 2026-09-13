import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3375',
  date: '2026-09-13',
  title: 'The portal shows the other party’s bills only when you chose to share them',
  kind: 'feature',
  highlights: [
    'A homeowner’s statement no longer lists the bills their builder pays, and a builder’s statement no longer lists the owner’s — the “On your jobs, billed to someone else” strip is gone in both directions, from the page and from what the page downloads.',
    'A bill you share with the other party (the switch arrives in the next release) shows on their statement in its own card: for a GC, “Your customers’ open bills” — who owes it, where, when it was billed and how long ago, what has been received, what is open; for an owner, “On your job, billed to your builder.” No Pay button, never in their balance.',
    'Nothing is shared until someone ticks it: every bill already sent stays visible to its payer only.',
  ],
}

export default note
