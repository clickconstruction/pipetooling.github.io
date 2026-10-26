import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5906',
  date: '2026-10-26',
  title: 'Ten more waiting lists read oldest first with an age chip',
  kind: 'feature',
  highlights: [
    'The Estimator inbox, the Help feedback inbox, the robots\' Operator questions, the Checklist Review inbox, Quickfill\'s People hours new and Can\'t reach, and the Field: Waiting for Approval queue now list the row that has waited longest first, the way the Dispatch inbox already does.',
    'Each of those rows, the Hours approvals queue\'s people, the Standing rulings\' question lines and the clause changes on Needs you carry an age chip beside the date: gray while fresh, amber once it has waited, red once it is late. The days are set per list, like 3 and 7 for an estimator request or 7 and 14 since the last try on a Can\'t reach prospect.',
    'The chip\'s hover still shows the full date and time the row had. Closed and answered rows keep their newest-first order, so the history still reads like a log.',
  ],
}

export default note
