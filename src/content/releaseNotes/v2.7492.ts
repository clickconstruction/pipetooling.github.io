import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7492',
  date: '2026-11-16',
  title: 'Print future stickers: the Which job? window says what a run would add to',
  kind: 'feature',
  highlights: [
    'Materials, Print future stickers used to list job names with a box count. Each job is now a card, as Print labels has: its site, the boxes it holds and the runs printed for it so far.',
    'A card says how many stickers are reserved and not on a box yet, which names, and who printed them and when. Open the job’s boxes goes to the page where they are put on their boxes.',
    'A card says the name a new run opens on. The band on top shows one sticker with that name at its printed size, and the printer’s own line.',
    'A job whose boxes did not load says so, with Read again. It used to read as a job with no box.',
  ],
}

export default note
