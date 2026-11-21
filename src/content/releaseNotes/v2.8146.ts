import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8146',
  date: '2026-11-20',
  title: 'Document builder: every press is big enough for a thumb on a phone',
  kind: 'fix',
  highlights: [
    'On a phone every press in the Document builder tab is 44 px tall, in both builders: Publish, the send presses, the link’s presses, Add a line and each line’s ×.',
    'They were 24 to 40 px tall there. On a computer nothing changed.',
    'The stops under a level slider are the same height on every page of the Sub NDA, so the slider no longer shifts between The basis and a topic.',
  ],
}

export default note
