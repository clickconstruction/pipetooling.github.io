import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5779',
  date: '2026-10-23',
  title: 'GC mode: a quote’s exclusion with no cost to cover it is a hole in our number',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'When a company’s quote says it leaves something out and nobody has put a cost on it, the trade now reads + ? everywhere the number shows: the project’s card, Our number, the price card and the Project Board.',
    'The card no longer says Send our bid while a carried quote has an exclusion with no cost. Next says Set the missing cost on that trade, and Compare quotes’ Against our budget row says not known yet.',
    'The words count what is open: 1 line and 1 exclusion have no cost yet. A Known exclusion, a unit price for if it comes up, or a cost to cover it closes it, as before.',
    'In the trade partner portal, a sent quote now reads back what the company ticked as left out.',
  ],
}

export default note
