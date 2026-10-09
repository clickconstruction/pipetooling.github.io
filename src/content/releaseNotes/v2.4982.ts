import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4982',
  date: '2026-10-08',
  title: 'Lien desk: a printed run is one row on Do now',
  kind: 'feature',
  roles: ['master_technician', 'assistant', 'controller', 'dev'],
  highlights: [
    'Two or more printed notices are now one Do now row, tagged Run, instead of a row each that all opened the same window.',
    'The row says when they printed and asks whether they were mailed. Record the mailing opens the run, and Take back… opens it on the take back question.',
    'Press The N jobs on the row to see which jobs are in the run. The find box still finds a job inside it.',
    'The rail’s Send the run step now counts the printed notices too, so it no longer reads 0 while notices wait in the mail.',
  ],
}

export default note
