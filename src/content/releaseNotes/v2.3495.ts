import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3495',
  date: '2026-09-16',
  title: 'Price requests: record every house you asked in one pass, each with its own day and its own quote link',
  kind: 'feature',
  highlights: [
    'On Edit Bid → Price requests, "+ Add a request" now takes as many houses as you asked. Pick the first and it becomes a card of its own; "+ Add another supply house" adds the next. The button counts what it will record — "Add 3 requests" — and writes them all at once.',
    'Every house carries its own "when it went out" date and its own quote link, so a batch you mailed on Friday can still hold the one quote that is already back. Leave a link empty and paste it later with Edit on the row.',
    'The picker says where you stand: a house you just added reads "already in this batch" and cannot be picked twice, and a house this bid asked before reads "asked Sep 2 · already on this bid" — still pickable, since asking again on a revised scope is fair, but never by accident.',
    'Editing a request you already saved is unchanged: one row, one house.',
  ],
}

export default note
