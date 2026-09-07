import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3036',
  date: '2026-09-07',
  title: 'Safety net under the Map default view',
  kind: 'fix',
  highlights: [
    'The default centre and zoom the Map opens on now has 7 tests pinning what a saved view must contain, how it is stored, and how saving from an address succeeds or fails; no behaviour change.',
  ],
}

export default note
