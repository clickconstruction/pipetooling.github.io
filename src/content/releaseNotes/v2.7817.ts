import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7817',
  date: '2026-11-18',
  title: 'Lien desk: a lien day that passed stays on the Board until someone answers it',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'A job whose lien day passed with nothing filed now stays in the Board’s closed bin, Lien day passed · not filed, until someone answers it. Before, it left the desk by itself seven days after its day.',
    'It leaves when the filing is recorded, the last day of work is set right, the job is taken off the lien path, it is marked Uncollectible, or it is paid.',
    'Older ones come back. Every job whose lien day passed more than a week ago with no answer is in the bin again, so each one gets an answer.',
    'The lien book, Materials and the law firm’s portal read as they did.',
  ],
}

export default note
