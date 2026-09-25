import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3816',
  date: '2026-09-25',
  title: 'A renamed Settings tab can no longer quietly break the after-deploy check',
  kind: 'fix',
  highlights: [
    'The automated check that loads the real site after every deploy failed for over a hundred versions because one Settings tab was renamed ("Digital twins" → "Digital twins & samples") and the check still looked for the old name.',
    'The check itself is fixed; now renaming a Settings tab without updating the check stops the change before it merges, so a red run keeps meaning a real problem.',
  ],
}

export default note
