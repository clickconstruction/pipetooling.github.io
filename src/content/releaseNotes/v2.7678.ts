import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7678',
  date: '2026-11-17',
  title: 'Supply houses: the aging windows are their own files',
  kind: 'infra',
  highlights: [
    'Nothing changes on screen. The window an aging cell opens, the move window’s worked list and its move steps work as they did.',
    'Those windows and what they read and write moved out of the Supply houses page into two files, with tests of their own.',
    'The page is now under 1,400 lines, down from 3,678 when these cuts began.',
  ],
}

export default note
