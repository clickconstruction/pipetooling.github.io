import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2207',
  date: '2026-08-23',
  title: 'Send to: one less thing on the GC chip',
  kind: 'fix',
  highlights: [
    'The GC group header on Pricing\'s Send-to strip no longer names a ★ price — with several versions it could name a different price than the one you were looking at. Each version chip still shows "· base", and the price cards say exactly what\'s on the letter.',
  ],
}

export default note
