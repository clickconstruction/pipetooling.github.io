import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2950',
  date: '2026-09-06',
  title: 'One spelling rule everywhere, and "these look like the same builder"',
  kind: 'feature',
  highlights: [
    'Case, punctuation, extra spaces, accents and "&" no longer split a name in two: "H & I" and "H&I" are one builder card on Why we lost, "José" and "Jose" one person on Crew P&L, "WATTS" and "watts" one manufacturer chip. One rule, used at every join.',
    'When two builder cards could still be the same company, Why we lost asks — "These look like the same builder: Acme Builders and Acme Builders LLC" — with Merge into either, or Keep separate. Merging changes only the grouping, never the bids.',
    'New guide: "merge two spellings of the same builder".',
  ],
}

export default note
