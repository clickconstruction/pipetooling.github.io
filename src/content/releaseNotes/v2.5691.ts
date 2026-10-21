import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5691',
  date: '2026-10-21',
  title: 'Reports: Escape closes the report form',
  kind: 'fix',
  highlights: [
    'Pressing Escape on the report form now closes it, the same as its Close button. From a job’s window the window stays open underneath, so Escape peels one layer at a time.',
    'Before, Escape did nothing on the form: the window underneath was told to ignore it while the form was up, and the form itself never listened.',
  ],
}

export default note
