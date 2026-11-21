import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8079',
  date: '2026-11-20',
  title: 'Painted maps: Draw it by hand instead brings the map back to the job',
  kind: 'fix',
  highlights: [
    'When Precise Location looks off, the map pulls back to a circle miles across. Pressing Draw it by hand instead left you on that wide view, with the job a speck to pinch for.',
    'The map now goes back to the job when you press it. A map with lines or places frames them. A new map goes to the place it opened on.',
  ],
}

export default note
