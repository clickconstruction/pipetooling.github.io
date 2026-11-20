import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8000',
  date: '2026-11-19',
  title: 'HR files: an assistant reads and records what a person was, employee or subcontractor',
  kind: 'infra',
  highlights: [
    'A developer’s assistant now reads a person’s standing over time when it opens their HR file, as the Standing window shows it.',
    'It can record a stretch, change the standing from a day, end a stretch, or take one off with a reason, after a dry run.',
    'The same rules hold as on People → HR. Two stretches never share a day, and nothing is deleted.',
    'Hours and pay are not touched.',
  ],
}

export default note
