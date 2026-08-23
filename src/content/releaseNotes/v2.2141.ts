import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2141',
  date: '2026-08-22',
  title: 'GC Review: Share menu says "Draft Message"',
  kind: 'fix',
  highlights: [
    'In Jobs → Pipeline → GC Review, each GC\'s Share dropdown now reads Draft Message · Copy · Print — the same name the certify checklist uses. It opens the statement email as a draft; nothing sends until you click Send statement.',
  ],
}

export default note
