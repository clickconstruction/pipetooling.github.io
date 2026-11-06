import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6572',
  date: '2026-11-06',
  title: 'The seal behind the Away note: an archived account that signs in reaches nothing but its one page (punch list #256, PR 7)',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Nothing changes for anyone yet. Archived accounts stay banned at sign-in until the Away note lands; this is the lock that makes that sign-in safe: a gate before every database request, a fence on every table and on file storage, and a guard for the edge functions.',
    'The seal is proven by a probe that signs in as an archived account and tries every table, every RPC and the storage, and reads nothing but the one page.',
  ],
}

export default note
