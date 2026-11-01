import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6256',
  date: '2026-11-01',
  title: 'A report’s photos show wherever the report is read',
  kind: 'feature',
  highlights: [
    'The Dashboard’s Recent reports, the Reports tab’s cards and rows, and the job window’s thread now show a report’s photos under its words: a thumbnail for one still on its way to Drive, a door to the file once it is there.',
    'A folded row with photos carries a badge, as in 📷 2, so you know a picture came with the report before you open it. A report with no photos looks as it did.',
    'The counts come from one read per list, so a long Reports tab stays as quick as before.',
  ],
  roles: ['assistant', 'controller', 'master_technician', 'dev', 'estimator', 'superintendent', 'primary'],
}

export default note
