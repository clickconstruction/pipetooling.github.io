import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2763',
  date: '2026-09-04',
  title: 'What customers see: sample pages open without signing in',
  kind: 'fix',
  highlights: [
    'The sample frames in Settings → What customers see no longer ask you to sign in; the sample customer, bid and sub are invented, so the pages open for anyone with the link.',
    'The sample links (estimate, bid room, portals, contract) work as stable demo links you can share.',
  ],
}

export default note
