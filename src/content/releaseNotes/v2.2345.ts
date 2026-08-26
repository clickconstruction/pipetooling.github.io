import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2345',
  date: '2026-08-26',
  title: 'Job addresses complete themselves',
  kind: 'feature',
  highlights: [
    'Start typing a Job Address in New Job or Edit Job and real addresses appear — biased to our service area, with what you typed shown in bold.',
    'Arrow keys + Enter (or a tap) take one; it lands street-comma-city, exactly how statements print it. Typing or pasting past the list works like always.',
    'Picking an address also teaches the Map where it is, so travel hints and pins work immediately.',
  ],
}

export default note
