import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5898',
  date: '2026-10-26',
  title: 'A refused save says why, not "Failed to save"',
  kind: 'fix',
  highlights: [
    'When the database refuses a save or a delete, the message now names the reason: no access to the record, a link that points at nothing, or the server\'s own words after the sentence you already knew.',
    'Before, hundreds of screens showed only their fallback ("Failed to save", "Could not load") whatever the server said, because the shared formatter did not read the shape a refusal arrives in.',
    'A lost signal still reads as "No connection" and nothing else; the words are decided by the kind of failure, never by guessing from the text.',
  ],
}

export default note
