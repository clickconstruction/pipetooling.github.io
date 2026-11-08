import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6704',
  date: '2026-11-08',
  title: 'Evidence that only links a Drive file can be marked as now a named document, the record staying in place',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'On the HR file, an evidence record whose files are all Drive links has a new press, Now a named document. Pick one of the person named documents and the record is stamped: superseded by that document, the day, who pressed it.',
    'The record stays where it is with its link and its memo. Nothing is deleted. The chip opens the named document.',
    "The agent's seat reads the mark on each record, so it follows the document instead of the old link.",
  ],
}

export default note
