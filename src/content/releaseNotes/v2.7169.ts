import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7169',
  date: '2026-11-13',
  title: 'People → Subs: a sheet with a sub and teammates counts for the sub, once',
  kind: 'fix',
  highlights: [
    'A sub sheet that named a sub and one or more teammates read as Multiple subs. Its money was left off every Balance due, while Jobs → Subs → Pay showed it as owed to the sub.',
    'People → Subs now uses the rule the Pay view uses. The sheet is the sub\'s, the whole balance is on the sub\'s row once, and the teammates are paid through payroll.',
    'The amber panel lists only sheets that need a hand: a name the roster does not know, or two subs on one sheet. A sheet two subs share stays on nobody\'s row, so it is never counted twice.',
    'Crew sheets, with teammates and no sub, get one grey line. They pay through payroll and are in nobody\'s Balance due.',
  ],
}

export default note
