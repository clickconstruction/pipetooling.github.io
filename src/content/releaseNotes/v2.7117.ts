import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7117',
  date: '2026-11-12',
  title: 'The Bridge keeps its check on a line when the link is taken off the task',
  kind: 'fix',
  highlights: [
    'A task made from a check on the Bridge now carries its own tag. The Bridge finds the task by that tag.',
    'Before, the Bridge found the task by its first link. Taking that link off the task lost the blue check, and the same line could be handed out twice.',
    'A task made before this is still found by its link.',
  ],
}

export default note
