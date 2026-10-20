import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5579',
  date: '2026-10-16',
  title: 'Prospects: New Prospect says where a company already lives',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Typing a company name or phone on New Prospect now checks the four places it could already be: this lane, another lane, the bench and the customers. One line says where, with one fact, like “Bexar Fire Protection is already on Subs. Called 12 days ago.”',
    'Open it goes to that record. A company that is already a customer still offers Link this lead to them on Jobs to GC.',
    'Save reads Save anyway while the line shows, because two branches of one company are real.',
  ],
}

export default note
