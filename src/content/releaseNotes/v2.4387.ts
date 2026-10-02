import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4387',
  date: '2026-10-02',
  title: 'Pipeline: the progress bar fits its cell and each bill’s bracket sits on its own money',
  kind: 'fix',
  highlights: [
    'A bill row’s bracket now sits where that bill’s money is on the bar. A bill with nothing paid sits on the blue. It used to land on the green when an earlier bill was the one left unpaid.',
    'A small last bill that names the job’s only line no longer brackets the whole bar.',
    'The Not done row under the bar prints the grey part’s own dollars, so the rows add up to the bid. Rows like “0% Not done $11,273” are gone.',
    'An empty % box with a field report reads like “30% reported Sep 25” and never runs out of the cell. The date sits right beside % done.',
  ],
}

export default note
