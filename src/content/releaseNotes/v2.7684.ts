import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7684',
  date: '2026-11-17',
  title: 'Lien desk: set the last day of work from under the Last work stop',
  kind: 'feature',
  highlights: [
    'On a notice or an affidavit, the timeline now has a press under Last work. It reads “change ›”, or “set the day ›” on a job with no clock hours and no day set by hand.',
    'The press opens the same window as Change › in Months on this job. You pick the day, see the dates that move, and type the reason, without scrolling down.',
    'The office sees the press. A person who cannot change the day sees the stop’s words alone. The Legal desk and the law firm’s page are unchanged.',
    'On a phone the press is its own line, a thumb tall. Clock hours and pay are not changed.',
  ],
}

export default note
