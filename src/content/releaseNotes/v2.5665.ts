import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5665',
  date: '2026-10-20',
  title: 'Pipeline: the progress bar fills each line from the crew’s own number',
  kind: 'feature',
  highlights: [
    'On a job whose lines are not stages, the Progress & payment bar used to pour the job’s one percent down the lines, so a 50 typed for the rough-in made the first lines read nearly done.',
    'Now, once the crew has said a number for any line in a field report, each line fills with its own number. A paid line reads full. A line nobody has said a number for reads empty.',
    'The words under the bar still say the job’s percent and where it came from. A job where no line has its own number draws as before.',
  ],
}

export default note
