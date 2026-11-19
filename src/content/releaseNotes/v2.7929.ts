import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7929',
  date: '2026-11-19',
  title: 'A primary reads the money of their own jobs only',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
  highlights: [
    'A job’s activity, supply house bills, parts and payment lines could be read by any primary, on any job. No screen showed them, but the database answered.',
    'Now a primary reads them on jobs where they are the account manager, sold the job, or wrote its signed estimate.',
    'A primary on a job’s crew still reads its plain activity lines and its supply house accounts. Everyone else reads as before.',
  ],
}

export default note
