import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6139',
  date: '2026-10-30',
  title: 'A job’s dates drawn against today, behind a Words | Track choice you make',
  kind: 'feature',
  highlights: [
    'A small Dates · Words | Track switch now sits on every Billed and Collections row’s dates block and on a job window’s Job tab. It opens on Words, so every screen reads as it did until you switch.',
    'Track on a Billed row lays the bill, the expected pay date and the lien date on one line against today. The guess wears a dashed ring marked guessed, with the pace behind it as a tag that opens the pay-speeds breakdown. A date the customer named is a solid blue ring marked their word. The room between the pay date and the lien flag is a green band with its days, red when it runs short. With no history the band reads Ask for a date.',
    'Track on the Job tab draws the job’s days as one strip from its first day to today: a diamond for the start, a filled dot for an approved field day, a ring for a day clocked but not approved, a blue tick for each bill. One last work line says where it came from, like approved Oct 12 or clocked out today, not approved yet. Press a day and the feed scrolls to it.',
    'One choice drives both surfaces and is remembered on the device. This is a prototype of punch list #217, built to look at before anything else changes.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
