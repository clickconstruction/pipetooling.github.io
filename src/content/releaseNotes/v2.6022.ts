import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6022',
  date: '2026-10-28',
  title: 'GC mode: a Templates page, where a schedule template is made as phases and rows and saved as a new version',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'GC projects has a Templates pill beside Customers. The list shows every template’s current version with its kind, rows, phases, weeks, who saved it and the jobs drawn from it, with a kind filter.',
    'New template opens the editor: phases and rows with no dates, each row a trade’s, ours or the office’s, with its days, what it waits on, a gap and a milestone tick. The line under the buttons says the weeks it makes from a Monday start.',
    'A save makes a new version. The one before keeps what the jobs drew and leaves the list. Rename and Set it aside act on the version open.',
    'From a job’s schedule saves a job being built as a template with its rows, and the job’s Templates card saves the same way.',
  ],
}

export default note
