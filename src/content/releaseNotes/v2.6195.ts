import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6195',
  date: '2026-10-30',
  title: 'The firm window opens on where the firm covers',
  kind: 'feature',
  highlights: [
    'Press a collections law firm’s name on the Legal desk and its window opens on where it covers: the county map with its counties in color and the other firms’ faint, and a row per county with its cases and what they owe.',
    'Press Show on the desk map and the Map view opens with that firm lit. A firm’s row under Who covers what lights it there too.',
    'While no county is colored for any firm, the window says the one firm takes every account by default and that the first county colored for anyone ends that, with a press to color its counties.',
    'The firm’s details and Click’s particulars fold to one line each, with Edit details and Edit particulars to open them. Replace this firm now says which counties would be left with no firm.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
