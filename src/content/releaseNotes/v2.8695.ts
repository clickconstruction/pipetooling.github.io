import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8695',
  date: '2026-11-27',
  title: 'A thrown-away test map says where its copy is for ten seconds',
  kind: 'fix',
  highlights: [
    'When a developer throws a test map away, a line says it can be put back from Recently deleted for 90 days.',
    'That line was gone after five seconds, before it could be read.',
    'It now stays for ten seconds. Its words are the same.',
  ],
}

export default note
