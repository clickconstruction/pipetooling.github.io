import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6031',
  date: '2026-10-28',
  title: 'The last read kept: one shape for every page, and the slow line names the time',
  kind: 'feature',
  highlights: [
    'The Pipeline has shown the board you last saw while the live one loads since September. That shape is now one piece every page can use: a read kept on your device, shown with its time while the live read runs, money muted and row presses held until it lands. The Pipeline reads exactly as before; the phone’s day, Quickfill and Messages take it next.',
    'While the page you see is a kept one and the app is slow, the line at the top adds “The page you see was read at 7:52 AM.” so you know how old what you are looking at is.',
    'Nothing is kept from a page whose reads did not all land, a kept read older than a day is not shown, and signing out clears every kept read on the device.',
  ],
}

export default note
