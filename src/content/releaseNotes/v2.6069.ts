import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6069',
  date: '2026-10-29',
  title: 'Signed hours statement: the paper and the rules behind it',
  kind: 'feature',
  highlights: [
    'The app can now put one worker’s recorded hours on one job onto a Letter page they can sign: each day with its in, out, hours and what they were working on, by week, with the rate, the amount and what the company paid for those weeks, or hours alone.',
    'A week the company has not paid reads not yet paid, and the words the worker signs under then leave out paid as shown. A session still waiting for approval is named under its day and never counted.',
    'When a period starts before the app’s first recorded day, the paper says so plainly and offers rows the worker fills in themself, marked as stated by them, not as recorded by the company.',
    'For now a developer prints it from a job’s Documents tab. The window for the office, the signing on a phone and the filing on a legal matter ship in the next PRs.',
  ],
}

export default note
