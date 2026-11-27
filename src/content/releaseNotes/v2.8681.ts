import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8681',
  date: '2026-11-26',
  title: 'Jobs: a ZZ test job a developer deletes takes its Drive folder to the trash',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'When a developer deletes a ZZ test job, the job’s own Drive folder now goes to Drive’s trash. It used to stay for someone to remove by hand.',
    'The Delete window says so first. A toast after the delete says what went to the trash, or why the folder stays.',
    'The folder stays when a bid, another job or a customer still keeps it, or when a person added a file to it by hand. The customer’s folder always stays.',
    'It is the trash, never a delete: the folder can be restored in Drive for 30 days. Nobody else’s delete changes, and no real job’s folder is touched.',
  ],
}

export default note
