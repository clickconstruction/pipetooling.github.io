import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5974',
  date: '2026-10-27',
  title: 'The Physical inbox says No connection in plain words',
  kind: 'fix',
  highlights: [
    'When Quickfill\u2019s Physical inbox could not read its papers for want of a signal, the line showed the browser\u2019s TypeError: Failed to fetch. It now says No connection in the app\u2019s own words.',
    'The No connection card behind What this means now reads Nothing was lost. Anything you typed is still on the screen, which is true for a read as well as a save.',
  ],
}

export default note
