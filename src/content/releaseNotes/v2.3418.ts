import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3418',
  date: '2026-09-14',
  title: 'Pipeline: the board learns where the crew is',
  kind: 'feature',
  highlights: [
    'Groundwork for the new Progress & payment cell: the Pipeline board now fetches, per job, the last day anyone clocked in and who, the newest sub sheet’s stage and crew, and the newest field report percent — everything the crews already record.',
    'Nothing changes on screen yet; the next release draws it on the row.',
    'Office roles only — the names of employees and subs stay off every other screen.',
  ],
}

export default note
