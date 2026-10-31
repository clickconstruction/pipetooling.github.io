import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6201',
  date: '2026-10-30',
  title: 'A Pipeline row opens its development',
  kind: 'feature',
  highlights: [
    'On Jobs → Pipeline, press the development name under a job, marked with the house, and the Development page opens: the whole site in one place.',
    'Before, that press filtered the board to the development. The filter is still there: the house dropdown by the search.',
    'The Mobile cards view has the same door. The plain phone rows open the job window, where the house line is already a door.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
