import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6579',
  date: '2026-11-06',
  title: 'The seal behind the Away note reaches every edge function: an archived account is refused before the service role does anything for it (punch list #256, PR 7b)',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Nothing changes for anyone yet. Archived accounts stay banned at sign-in until the Away note lands; this is the fourth lock, in every one of the 104 functions that read who is calling and then act with the service role.',
    'A new function that reads the caller and switches to the service role must carry the same guard, or the build refuses it.',
  ],
}

export default note
