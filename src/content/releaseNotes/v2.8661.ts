import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8661',
  date: '2026-11-26',
  title: 'Activity and tasks: a test note that answers a tag says it stays, before you press',
  kind: 'fix',
  highlights: [
    'A developer’s Delete… was live on a test job’s note that a tag names as its answer. The press asked to confirm and then said the note stays.',
    'Now Delete… is grey on such a note, and the line beside it says how many tags name it and that it stays.',
    'The same holds for a comment on a test task. Nothing changes for anyone but a developer.',
  ],
}

export default note
