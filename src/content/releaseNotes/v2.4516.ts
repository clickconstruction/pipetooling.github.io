import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4516',
  date: '2026-10-04',
  title: 'Overhead: Man hours fits the screen it is on',
  kind: 'feature',
  highlights: [
    'On a wide window, the who list now stands beside the Man hours picture. Click a bar and the list next to it changes, with no scrolling. The card is a little over half as tall as it was.',
    'On a phone, the picture shows every period at once. It no longer scrolls sideways or opens on the oldest months.',
    'In the two tables, the name column stays put when the numbers scroll sideways.',
    'The picked bar has a narrow band behind it. In the who list, time under half an hour reads <1 where it used to be a blank.',
  ],
}

export default note
