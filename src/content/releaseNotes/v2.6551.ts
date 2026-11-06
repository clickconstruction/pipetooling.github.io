import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6551',
  date: '2026-11-05',
  title: 'Pipeline: a Checklist left chip in the search bar narrows the board to the jobs with a question left (punch list #246 closed)',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'superintendent', 'estimator'],
  highlights: [
    'The Pipeline’s search bar shows Checklist left · N beside the hidden-groups chip whenever a job on the board has a question left on a stage checklist. The number is how many jobs.',
    'Press the chip and every section narrows to those jobs, in their usual order. Press it again to show every job.',
    'This was the card’s last PR after the checklist door on the row, so punch list #246 closes.',
  ],
}

export default note
