import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3763',
  date: '2026-09-23',
  title: 'Lien filings keep a link to the saved copy',
  kind: 'feature',
  highlights: [
    'Every recorded lien paper — a § 53.056 notice, a lien affidavit, a release — can now carry a link to the saved copy and a line beside it: a Drive link, plain text, typed when you record it or added to the row later with “link the saved copy”.',
    'The boxes sit on Record the run, on the Lien window’s three record steps, and on each recorded filing’s row, which then reads “Saved copy · Drive ›”; the Legal desk’s filings table gains a Copy column.',
    'First step of the punch list’s “Lien notices sent by hand” item — a notice the office mailed outside the run can be recorded after the fact next.',
  ],
}

export default note
