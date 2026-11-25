import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8607',
  date: '2026-11-25',
  title: 'Working hours: taking them off a salaried person leaves the standard week',
  kind: 'fix',
  highlights: [
    'Take working hours off now puts a salaried person’s week on pay back on the standard week, 8 hours Monday to Friday.',
    'Before, pay kept the hours last set, though nothing held the person to them any more.',
    'The window says what their week is today and asks why. The reason goes on the pay log with the week before and after.',
    'A person already on the standard week, and a person paid by the hour, see no change to pay.',
  ],
}

export default note
