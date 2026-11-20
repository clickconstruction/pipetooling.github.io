import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8002',
  date: '2026-11-19',
  title: 'HR files: an assistant can ask when each section of a summary or narrative last changed',
  kind: 'infra',
  highlights: [
    'A developer’s assistant can now ask when each section of a person’s summary or narrative last changed.',
    'It also learns how many entries were written since, and which sections a newer entry points at.',
    'This is what the fold on People → HR already shows. The assistant reads it only when it asks.',
  ],
}

export default note
