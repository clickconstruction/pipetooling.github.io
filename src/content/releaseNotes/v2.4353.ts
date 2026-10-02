import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4353',
  date: '2026-10-01',
  title: 'Pipeline: a bill row marks its own bill on the progress bar',
  kind: 'feature',
  highlights: [
    'On a job with two or more bills, a bracket under the bar marks where this row’s bill sits. On a staged job the bill’s stage name is bold instead.',
    'A bill that is part paid now fills its line green for the paid part and blue for the rest. It used to read all blue.',
    'A finished job has no bold stage, and the date beside a 100% is left off unless the crew has worked since.',
  ],
}

export default note
