import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3601',
  date: '2026-09-18',
  title: 'Prospects → Hiring: candidate cards that read the same way every time',
  kind: 'fix',
  highlights: [
    "A candidate's name no longer shatters into two-letter lines next to the \"call next\" and \"also in\" badges — the name gets the line, and the badges move to a row of their own underneath it. The drag handle, rank and gear stay on the first line even when a long name wraps.",
    'Phone, email, source and last contact stack one per line on every card, so cards line up instead of each wrapping its own way. A long email breaks before the @, not in the middle of the domain.',
    'Talked today, Advance and Passed fit on one line; Passed is the quiet one on the right instead of a stray red button on a line by itself.',
    'A candidate nobody has rated yet shows no rating bars — three empty "—" rows said nothing. The bars appear with the first score.',
  ],
}

export default note
