import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2897',
  date: '2026-09-05',
  title: 'Nothing is thrown away or written without a word',
  kind: 'fix',
  highlights: [
    'New Job: Cancel, Escape or clicking outside a half-typed job now asks "Discard this job?" — an untouched form still closes instantly. Escape closes only the window on top, so closing New Job no longer also closes the bid you opened it from.',
    'Bids → Counts: the "Imported N rows" toast carries an Undo button for ten seconds. It removes exactly the rows that import added and puts the CountTooling plans link back the way it was.',
    'RFQ desk: "Close link" asks first and is no longer forever — every closed request lists a Reopen link, which makes the supply house\'s page work again.',
    'Estimates: Send now confirms the recipient\'s email before anything goes out (a $0 total is called out in the same ask). Crew P&L: the sub rate is labelled org-wide and saves only when you click "Save for everyone" — leaving the box empty never resets it to $50. Dispatch Settings says which sections save as you go.',
  ],
}

export default note
