import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8295',
  date: '2026-11-22',
  title: 'Permits: a lawn sprinkler permit no longer reads as Has a plumber',
  kind: 'fix',
  highlights: [
    'A city files sprinklers, gas lines and sewer taps under plumbing. Any of them on a building’s permit read as Has a plumber and took the building off the skim.',
    'Now only the building’s own plumbing permit counts, the same rule a bid’s window already reads by. Builders and Market follow it too.',
    'In San Antonio eight buildings of the last 180 days go back to waiting. Austin, New Braunfels, San Marcos and Seguin read as before.',
  ],
}

export default note
