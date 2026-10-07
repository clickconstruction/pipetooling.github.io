import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4717',
  date: '2026-10-07',
  title: 'Lien desk: setting the last day of work by hand shows what moves first',
  kind: 'feature',
  highlights: [
    'Save the day on the last-day line opens a window before anything is written. It says how far the day sits from the clock hours, in words, so a wrong month number reads wrong at once.',
    'A table shows only the dates the day touches: the months the notice names, the § 53.056 window of the last month, the § 53.052 affidavit and the § 53.158 suit date, today beside the new day, changed rows lit.',
    'A day earlier than the hours, a day after today, or the same day the job already reads is refused inside the window. A day far past the hours reads Set the day anyway. A new month whose window already closed is named as one that would read as missed.',
    'The reason is typed in the window, after the consequences, and is required.',
  ],
}

export default note
