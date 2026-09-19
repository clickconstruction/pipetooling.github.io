import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3600',
  date: '2026-09-18',
  title: 'Pipeline loads faster: the board paints from the first query, and the details fill in a moment later',
  kind: 'feature',
  highlights: [
    'Pipeline (Jobs → Stages) shows its rows as soon as the jobs themselves arrive. The materials, fixtures, last scheduled day and estimate banner on each row land a moment later, all at once, instead of holding the whole board back.',
    'Those detail passes now run together, once for the whole board, rather than one after another for every open section — fewer requests, and the last one finishes sooner.',
    'Nothing on the screen changed: a row that has not filled in yet simply reads without its stage bar or estimate footer until it does.',
  ],
}

export default note
