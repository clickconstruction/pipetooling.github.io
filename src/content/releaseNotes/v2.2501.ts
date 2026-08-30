import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2501',
  date: '2026-08-29',
  title: 'Filing plans twice no longer duplicates the plan set in Drive',
  kind: 'fix',
  highlights: [
    'Re-running plan intake on a bid now reuses the plan set already in the job folder instead of uploading a second copy.',
    'The response and the bid feed note say whether the file was uploaded fresh or reused.',
  ],
}

export default note
