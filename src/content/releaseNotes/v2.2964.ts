import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2964',
  date: '2026-09-06',
  title: 'Safety net under the My Time day editor',
  kind: 'infra',
  highlights: [
    'Nothing changes in the app. The two calculations behind the My Time day editor — how a day splits, merges and snaps into segments, and how each save decides which clock rows to write — now have 54 tests pinning their behaviour, so a future change cannot quietly alter what lands on a timesheet.',
  ],
}

export default note
