import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2992',
  date: '2026-09-07',
  title: 'Contract HTML cleanup no longer gives up on long bodies',
  kind: 'fix',
  highlights: [
    'The cleanup that scrubs pasted HTML before a contract body, help guide or HR document is shown used to stop after 200 stray tags and leave the rest as-is; it now cleans the whole body every time.',
    'That cleanup now has 10 tests pinning what it keeps (paragraphs, lists, tables, safe links) and what it removes (scripts, frames, forms, handlers, unsafe links).',
  ],
}

export default note
