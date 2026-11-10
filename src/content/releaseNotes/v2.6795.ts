import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6795',
  date: '2026-11-09',
  title: 'The dev seat flags a job for Collections and records the contract’s end',
  kind: 'feature',
  highlights: [
    'A dev’s agent can now put a Billed job in Collections with a note, or take it out, through the same press the Job window uses: the plan shows the mark before and after and the activity line it will write, and the apply runs the app’s own rule.',
    'It can also record the end of our contract on a job as the Lien contract row does: the day, how it ended (complete, terminated or abandoned), the retainage held and whether a payment bond is on the project, or clear it again. The Lien desk’s clocks and the retainage line read from it at once.',
  ],
}

export default note
