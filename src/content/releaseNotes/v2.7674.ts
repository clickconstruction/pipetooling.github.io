import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7674',
  date: '2026-11-17',
  title: 'Supply houses: the bill form’s window is its own file',
  kind: 'infra',
  highlights: [
    'Nothing changes on screen. The Add invoice and Edit invoice window looks and works as it did.',
    'The window’s 630 lines moved out of the Supply houses page into a file of its own. The page is now about a third shorter than when these cuts began.',
  ],
}

export default note
