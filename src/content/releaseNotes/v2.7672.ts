import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7672',
  date: '2026-11-17',
  title: 'Supply houses: the tab has its own test before its windows move',
  kind: 'infra',
  highlights: [
    'Nothing changes on screen. This adds a test that opens the Supply houses tab the way the office does and presses what the office presses.',
    'It covers a house and its bills, the bill form saved, edited and deleted, a bill marked paid, the aging windows and Create PO.',
    'It is the guard for the next cuts, which move the form and the windows into their own files.',
  ],
}

export default note
