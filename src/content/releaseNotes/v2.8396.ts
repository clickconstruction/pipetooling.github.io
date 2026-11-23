import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8396',
  date: '2026-11-23',
  title: 'Supply house bills: the app can read a bill’s PDF itself',
  kind: 'feature',
  highlights: [
    'Groundwork for opening a supply house bill inside the app. The app can now read the PDF a bill links, with no Google sign-in.',
    'Only someone who can already open the bill gets its PDF, and only a file kept in the bills folder is read.',
    'Nothing on screen changes yet. The bill viewer that uses it comes next.',
  ],
}

export default note
