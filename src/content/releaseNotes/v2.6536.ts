import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6536',
  date: '2026-11-05',
  title: 'The material location report keeps every word on the paper',
  kind: 'fix',
  highlights: [
    'A long Last recorded no longer gets cut off at the edge of the page. A two-word name or an older date now fits on one line, and anything longer wraps inside its box.',
    'The report now prints at full size whatever the names are. A long name used to make the browser shrink the whole paper.',
    'On a phone each line stacks, with the part, its count and its unit on top and Last recorded under them, so nothing needs a sideways scroll.',
    'Escape now closes the report window.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
