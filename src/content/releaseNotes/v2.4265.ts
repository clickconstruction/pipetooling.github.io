import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4265',
  date: '2026-09-30',
  title: 'Lien calendar: every row starts at the day the work ended, a dead lien goes grey, and the key is a strip of marks',
  kind: 'feature',
  highlights: [
    'Every job row on the Lien desk’s Calendar now begins with a small tick on the last day worked, with its date under it — the day every notice and lien date on that row is counted from. A job with no approved hours shows a hollow amber tick that says so: the board is counting from the month the job was created, and that is a stand-in worth checking before a notice goes out.',
    'A GC’s row says the next move once — “send 11 notices by Oct 15 · 15 d” — and its jobs no longer repeat it. A job speaks only when its deadline differs (“notice by Nov 16 · 47 d”). The dashed “no pay date” dot sits on the GC row alone, where one word covers every job.',
    'When a lien can no longer be filed — the notice window or the lien window closed unsent — the row goes grey from that day to the right edge, with the reason under a red flag and one line: nothing left to file after this day; the money is still owed.',
    'The key is a row of marks with a few words under each; tap a mark for the full explanation and, where the board has a door for it, the door itself (Set kinds, biggest first · Draft the notices). The property-kind bracket now also shows on jobs counted from their creation day, and the cream row tint is gone — the bracket and the “Set kinds” to-do already say it.',
  ],
}

export default note
