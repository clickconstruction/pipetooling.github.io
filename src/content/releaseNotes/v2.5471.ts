import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5471',
  date: '2026-10-13',
  title: 'Job activity shows a job’s calls, texts and emails to its techs too',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'helpers'],
  highlights: [
    'A tech who worked a job this week or last now sees the customer’s calls, texts and emails tied to that job in its Job activity.',
    'Techs get the Customer pill too. A note kept for the office never shows to a tech.',
    'A note kept for the office now says only the office sees this. Other team notes still say only the team sees this.',
    'The link to the whole thread stays with the office for now.',
  ],
}

export default note
