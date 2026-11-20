import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8039',
  date: '2026-11-20',
  title: 'On an iPhone, Loading no longer hides behind the camera',
  kind: 'fix',
  highlights: [
    'When the app starts or reloads from the Home Screen, Loading now sits below the clock and the camera.',
    'The same goes for Updating app, for the Reload button that follows a lost page, and for Opening on the Add Task icon.',
    'A message in the top corner stays below the clock too, on a page scrolled down or one with no header.',
    'Nothing moves in a desktop browser or on Android.',
  ],
}

export default note
