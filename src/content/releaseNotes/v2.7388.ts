import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7388',
  date: '2026-11-15',
  title: 'People → Subs: Balance due opens into its sheets (PR 2 of the sub labor train)',
  kind: 'feature',
  highlights: [
    'Press a sub’s Balance due and their sheets open under the row, grouped by job, with what was agreed, paid and still open. A green check says the sheets add up to the figure in the column. Pay… and Back-charge… open from the same row.',
    'A sheet that names one teammate and no sub is now owed to that teammate, as sub labor on top of their wages. It shows on this page with a Team · sub labor chip instead of sitting in no figure.',
    'Four tiles sit over the roster, with an Owed chip, a search by sub or job, a sort and Export CSV. On a phone each sub is a card.',
    'The amber band counts sheets that need one sub, once. Whose is it… takes the place of Assign… and shows what a choice adds to each Balance due before anything is saved.',
  ],
}

export default note
