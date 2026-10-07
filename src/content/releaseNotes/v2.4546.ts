import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4546',
  date: '2026-10-05',
  title: 'Submittals: save one row\'s cut sheet as its own PDF',
  kind: 'feature',
  highlights: [
    'A row that has a cut sheet now shows Save PDF under its pages. It saves just that row\'s pages as a small file named for the tag, like "LAV-1 cut sheet.pdf".',
    'Attach the file to an email or a text for a superintendent, an installer or a supply house. Before, the only PDF you could get was the whole package.',
    'Nothing is sent from the tab, and nothing on the submittal changes.',
  ],
}

export default note
