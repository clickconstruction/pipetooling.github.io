import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2434',
  date: '2026-08-28',
  title: 'CountTooling bridge, part 1: the join key',
  kind: 'infra',
  highlights: [
    'PipeTooling is becoming the single system of record for people — accounts on CountTooling will be created, flagged, and retired on PipeTooling’s command.',
    'Every person can now carry a durable link to their CountTooling account (a real id, not a matching email), and the Digital twins console shows each twin’s CT seat as linked or missing.',
  ],
}

export default note
