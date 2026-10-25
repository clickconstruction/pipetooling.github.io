import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5848',
  date: '2026-10-25',
  title: 'The Collect desk, PR 1 of 7: the pile read by each payer’s own pace',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'The rules behind the Bridge’s coming Collect desk, with nothing on screen yet. Every open bill is read by where it stands against its payer’s own pace: not yet due, promised, past a promise, late, or doubtful, with Collections kept apart.',
    'A payer with a pay application on the job reads as a GC, and a GC with no pay history reads at the GC pace here, the median of the GCs who have paid us. Anyone else with no history reads at the commercial or residential median.',
    'The bills are grouped by payer, biggest first, with the fewest payers that hold nine tenths of the pile cut out as the call sheet and everyone else as one line.',
  ],
}

export default note
