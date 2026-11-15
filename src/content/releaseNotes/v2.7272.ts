import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7272',
  date: '2026-11-14',
  title: 'Materials on site: print a run of blank stickers before the boxes',
  kind: 'feature',
  highlights: [
    'Print blank stickers sits beside Print labels on a job’s On site strip and at the right end of the Materials tabs. It asks how many, with 30, 60, 100 and 200 one press away, and Copies of each for a box with more than one side. One press numbers the run and prints it on Brother tape, each strip with the code to scan and the number to read.',
    'The office, a primary and a superintendent print a run. For everyone else the press is grey and says why. A refusal from the database is said in its own words, and a run refused takes no numbers.',
    'A printer that stops part way says how many stickers went, and the press becomes Print the rest with their numbers. A test strip prints before a run and is not a sticker.',
    'Under a job’s boxes, Runs lists every run of stickers: its numbers, who printed it and when, how many are on boxes and how many are not used yet. Reprint prints a run again with the same codes. Print the rest prints only the stickers still blank. The window exports the run as a CSV.',
  ],
}

export default note
