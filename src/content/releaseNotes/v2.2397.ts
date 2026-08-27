import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2397',
  date: '2026-08-27',
  title: 'Price-book search: see why it matched, and an Exact mode',
  kind: 'feature',
  highlights: [
    'The assign-a-book-entry dropdowns (Old view and the Workbench) now highlight the exact characters that matched your search — a row that only matched "90" stops being a mystery.',
    'A Similar | Exact toggle sits in the dropdown\'s corner: Similar is the familiar any-word ranking; Exact keeps only entries containing every word you typed. Your choice is remembered on this device.',
    'When a search word matches nothing in the book, the dropdown says so; when Exact finds nothing, one tap shows the similar matches instead.',
  ],
}

export default note
