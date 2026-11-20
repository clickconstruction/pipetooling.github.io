import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7968',
  date: '2026-11-19',
  title: 'Tests and two help guides drop the last lone words from live records',
  kind: 'infra',
  highlights: [
    'The last sweep swapped whole names and addresses. A few single words from live records were still sitting alone in tests and in two help guides, and they are now made-up words too.',
    'Two help guides show a made-up surname and a made-up street in their examples.',
    'Nothing else on any screen changes.',
  ],
}

export default note
