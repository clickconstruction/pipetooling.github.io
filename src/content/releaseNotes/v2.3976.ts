import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3976',
  date: '2026-09-27',
  title: 'GC statements: the Dashboard row and the morning email are for the office',
  kind: 'feature',
  highlights: [
    'The Dashboard’s Needs you row now counts every GC statement that is checked and ready to send, whoever the account man is, and says how many of those GCs broke a promise.',
    'The morning email is now the week’s list: every GC over $10,000 grouped by the account man to call, each with its next step, the last word and the date they promised. It no longer tells the account man the week is his to fix.',
    'Each group in the email opens its call sheet. In GC Review the email reads “Email me the week’s list…”.',
    'Both switch over once the database update is applied; until then they work as before.',
  ],
}

export default note
