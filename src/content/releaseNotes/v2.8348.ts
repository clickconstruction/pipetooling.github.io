import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8348',
  date: '2026-11-23',
  title: 'Agreements: a paper with an outside company can be taken back',
  kind: 'feature',
  highlights: [
    'A paper that is with an outside company and is not signed now carries Take back on its line, under Documents → Agreements.',
    'Take back deletes the paper and its signing link stops working. A window says so first, and nobody is emailed.',
    'A signed paper is kept. If they sign while you decide, the paper stays and the app tells you.',
  ],
}

export default note
