import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7763',
  date: '2026-11-18',
  title: 'Trips: put an Extra trip on a bill',
  kind: 'feature',
  highlights: [
    'An open trip marked Extra that has gone out now shows Put on a bill beside Change. It opens a small window with the job, an amount you type, the line’s name and the words under it, and the job total before and after.',
    'Add the line adds the trip as one line on the job. The job’s window then opens on Bill with that line picked, so Bill the 1 picked bills the trip by itself. Leave it, and the job’s next bill carries it. Nothing is sent to the customer by the press.',
    'The trip’s billing chip now says where its money stands: not billed yet, on the job’s lines, on a bill, billed or paid. A trip that is on a job’s lines shows a door to that job in place of the press.',
    'The press shows to the office, the leaders and the controller. A trip’s line is an ordinary line you can rename, reprice or remove in the job’s window. It is not a trip charge, which stays the fee for a turnaway.',
  ],
}

export default note
