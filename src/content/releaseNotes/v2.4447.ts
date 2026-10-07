import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4447',
  date: '2026-10-02',
  title: 'Every window sits below the iPhone clock',
  kind: 'fix',
  highlights: [
    'On an iPhone with the app on the Home Screen, a tall window could put its title and its × under the clock.',
    'Every window now starts below the clock, the signal bars and the battery. A phone’s full-height sheets do too.',
    'On a computer, an Android phone or a browser tab nothing moves.',
    'A new window that leaves no room for the clock can no longer ship: a check stops it first.',
  ],
}

export default note
