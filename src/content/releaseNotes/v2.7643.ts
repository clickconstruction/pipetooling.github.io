import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7643',
  date: '2026-11-17',
  title: 'Signed contracts: the app can now file one in its job\'s Drive folder',
  kind: 'feature',
  highlights: [
    'The app can now put a signed contract in its job\'s Google Drive folder, under Team only, Contracts, and hand it to Find a file. Nothing runs it by itself yet, and no screen shows it.',
    'A paper the office already keeps in the jobs drive is tied to its record where it sits. It is not copied, moved or renamed.',
    'A signed contract is never filed in a folder that anyone with its link can open. The paper waits, with that reason, until the link is closed.',
    'Signing is untouched. A paper that cannot be filed stays safe in the app with its reason.',
  ],
}

export default note
