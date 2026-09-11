import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3307',
  date: '2026-09-11',
  title: 'Bids → Labor: the book checks itself against finished jobs',
  kind: 'feature',
  highlights: [
    'The New view’s head gains a Book vs jobs tile: over every job linked to a bid that priced with this book, the crews’ recorded hours against the hours the book predicted — “book runs ×1.18 light · 3 jobs”. A job counts once it is at least 25 % done with 8 or more field days; younger jobs say nothing yet.',
    'Each filled row wears an evidence chip — 3 jobs agree · 2 jobs · wide · no jobs yet. Tap it to open the evidence: what the book said for that entry on each job and what the crew ran (the job’s hours shared out by the book’s own weights). Set writes the median-scaled hours onto the book entry; Keep leaves it.',
    'Link jobs to their bids (the job’s Costs tab, the Bid Board’s Link chip, or Settings → Data) and the evidence fills in.',
  ],
}

export default note
