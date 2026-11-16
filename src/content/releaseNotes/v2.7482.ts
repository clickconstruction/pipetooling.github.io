import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7482',
  date: '2026-11-16',
  title: 'Print labels: the Which job? window says what you are about to print',
  kind: 'feature',
  highlights: [
    'Materials, Print labels used to list job names with a count. Each job is now a card with its site, its boxes and cages, their names and how many stand in each place.',
    'A card counts the boxes added this week, the boxes that already wear a sticker and the empty ones. It says how much tape the job takes, or how many pages.',
    'A band on top shows what this computer prints on, the printer’s own line and one label at its printed size. A browser that cannot reach the P-touch says so before a job is picked.',
    'A run stopped earlier today is said on its job. Buttons under a card open the labels on the rest of that run, on the new boxes or on every box.',
  ],
}

export default note
