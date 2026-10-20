import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5632',
  date: '2026-10-19',
  title: 'Where the conversation stands, from the Pipeline: the thread’s last lines and a waiting dot',
  kind: 'feature',
  highlights: [
    'The customer sheet behind a Pipeline row’s speech bubble now shows the last three lines between you and the customer, theirs with an orange bar, so you know where things stand before you write.',
    'The speech bubble carries a small orange dot when the customer wrote last on this job and nobody has answered. Hold over it to read who wrote, how, when and their first line.',
    'The dot reads the same Needs a reply list as Follow up, once per load of the board, and goes once anyone answers them, from the sheet or anywhere else.',
  ],
}

export default note
