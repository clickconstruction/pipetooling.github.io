import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4099',
  date: '2026-09-28',
  title: 'A payment promise now shows in the job\'s activity',
  kind: 'feature',
  highlights: [
    'When someone records what a customer said about paying — "They said…" on a Pipeline row, the GC\'s word on a statement round, or a date the customer named on their statement page — it now appears in the job\'s activity feed as a "They said" line, in order with the notes, reports and clock-ins around it.',
    'The line reads the date with its year, who said it, how, who heard it and any note. A promise later marked "they never said that" leaves the feed.',
    'Nothing is written twice: the feed reads the promises on record, so every promise ever recorded shows, not only new ones.',
  ],
}

export default note
