import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6221',
  date: '2026-10-31',
  title: 'Extend a firm’s counties from its own window',
  kind: 'feature',
  highlights: [
    'In a collections law firm’s window, a dev presses Extend coverage, or Color its counties when none are colored yet. The map turns into the picker for that firm alone.',
    'Add by area colors the Austin or San Antonio counties in one press. A red chip adds every county that holds a case with no firm.',
    'The list follows your picks, so you see the cases and dollars each county brings before you save. The save button says how many counties it will save.',
    'While no county is colored for any firm, the window warns that the first save ends the default and names any account in review it would leave with no firm.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
