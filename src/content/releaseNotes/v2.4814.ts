import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4814',
  date: '2026-10-07',
  title: 'Legal desk: a session can file the narrative and documents',
  kind: 'infra',
  highlights: [
    'A developer’s Claude session can write a matter’s narrative for the firm. It shows a plan first, naming the matter and whether the firm reads it, and saves only that plan.',
    'A developer can file a folder of documents onto a matter from a list that gives each one a title and a line on what it shows. Every file is checked first, and nothing is written until asked.',
  ],
}

export default note
