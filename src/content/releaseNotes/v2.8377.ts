import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8377',
  date: '2026-11-23',
  title: 'A window that cannot load no longer takes the page behind it',
  kind: 'fix',
  highlights: [
    'When a window cannot load, only the window gives up. A line says “The job could not open. Check your signal, then press it again.” and the page behind it stays as it was. Before, the whole page was replaced.',
    'This covers the job, the job form, a bid, a customer, the customer form, a person’s review, a person’s desk and the painted map.',
    'Fifteen pages showed a red sentence with nothing to press when they could not load, among them Messages, Training, Bills sent, Quickfill, the Projects board, Partnerships, My statement and the Logbook. They now show the same words and Reload press every other page has.',
  ],
}

export default note
