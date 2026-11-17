import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7531',
  date: '2026-11-16',
  title: 'Bids: the groundwork to keep a mail’s files as a set of plans',
  kind: 'feature',
  highlights: [
    'The app can now file a mail’s attachments into a bid’s own Drive folder, under Plans, and add them to the bid as a set of plans.',
    'Nothing new shows on a screen yet. The press that uses this comes next, on the mail itself in Messages.',
    'A file is marked as kept only once it is in the folder, so a mail never says kept for a file that did not land.',
  ],
}

export default note
