import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4735',
  date: '2026-10-06',
  title: 'Lien window: change the last day of work from its timeline',
  kind: 'feature',
  highlights: [
    'The Last work stop on the Lien window’s timeline has change ›. It opens the same line as All filings, and Save the day opens the same window that shows what moves.',
    'On Deadlines, the date where a row’s bar starts opens the Lien window with that line ready to type in.',
    'The Lien window now reads a last day set by hand. Before, it kept counting from the clock hours or the job’s creation day.',
    'A day set by hand, here or in All filings, moves the Deadlines row to its new group right away.',
  ],
}

export default note
