import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8077',
  date: '2026-11-20',
  title: 'Before we start: a press that landed is never reported as lost',
  kind: 'fix',
  highlights: [
    'A press on Before we start saves first and then reads the list again. A lost signal on that second step used to say the press was not kept.',
    'Now the list says it could not load and offers Retry. Your press is kept, and Retry shows it.',
    'This stops a second press from adding the four starter bullets twice or writing a second Go.',
  ],
}

export default note
