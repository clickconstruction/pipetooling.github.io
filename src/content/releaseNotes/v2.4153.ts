import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4153',
  date: '2026-09-29',
  title: 'Lien calendar: the pen — record what they said from the board, and act on the to-do',
  kind: 'feature',
  highlights: [
    'Click a job\'s pay dot (or the dashed dot on a row with no date) and "They said…" opens right there: the day, whose word it is (the owner, or the GC on a sub job), a note — with the consequence read back before you save: "44 d of room before the lien flag" or "4 d after the lien flag — file first". Save writes the same promise the Pipeline chip and the job\'s activity carry.',
    'A GC\'s row carries one dot when every one of its jobs agrees on a date — the GC\'s word from the statement round. Click it to give the GC\'s word for all of its jobs at once.',
    'The to-do\'s doors work: "Draft the N" takes those jobs to the Notices tab, To draft, narrowed to them until you clear the chip; "Set kinds, biggest first" opens a sheet of the properties with no kind, largest balance first, with the switch on each — the flags move as you set them.',
    'Click a bar on the density strip to make its column the to-do\'s first sentence.',
  ],
}

export default note
