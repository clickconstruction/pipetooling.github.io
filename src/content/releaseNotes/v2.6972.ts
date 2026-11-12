import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6972',
  date: '2026-11-11',
  title: 'The HR file shows evidence numbers and keeps a case’s open items and log',
  kind: 'feature',
  highlights: [
    'A piece of evidence shows its number, like Ev #81, beside its title. Write Ev #81 in an entry and it becomes a press that opens that piece of evidence.',
    'A new Case view lists a case’s open items, each with a number the file gives it and who has it. Close an item with a reason, hand it over, or open it again.',
    'The Case view keeps the log too. Every change to an item writes its own line.',
    'For older evidence, the Evidence view shows what numbering would do before anything changes. Records that share a number are listed and left alone.',
  ],
}

export default note
