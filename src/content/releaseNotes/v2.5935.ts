import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5935',
  date: '2026-10-26',
  title: 'Every staff screen says why a save failed',
  kind: 'fix',
  highlights: [
    'When the database refuses a save, a delete or a load, every staff screen now names the reason: no access to the record, a link to something that is gone, or the server\'s own words after the screen\'s sentence.',
    'Before, about three hundred screens showed only their own fallback, such as Failed to delete or Could not save, whatever had gone wrong.',
    'A lost signal still reads as No connection, and nothing else does. Pages a customer opens keep their own plain words, so a customer never sees a server\'s message.',
  ],
}

export default note
