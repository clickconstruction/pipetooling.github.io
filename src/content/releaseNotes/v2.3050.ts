import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3050',
  date: '2026-09-07',
  title: 'Safety net under the Mercury split and attribution reads',
  kind: 'fix',
  highlights: [
    'The shared reads that load card-charge job splits and who-was-attributed for Banking, Jobs, People and Quickfill now have 6 tests pinning how large id lists are chunked and paged and that a failed read never looks like "no splits"; no behaviour change.',
  ],
}

export default note
