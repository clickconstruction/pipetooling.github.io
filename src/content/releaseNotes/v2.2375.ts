import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2375',
  date: '2026-08-26',
  title: 'A calendar timeline for dated tasks',
  kind: 'feature',
  highlights: [
    'Manage gains a 📅 Timeline view: every one-off with a due date on a real calendar — solid bars from start to due, weekends shaded, a red today line.',
    'Pushed tasks draw their slip: a hollow amber circle marks the original promise (it never moves), a hatched trail stretches to the current due date, and a "→ pushed ×2 · +5d" badge says it in words.',
    'Done bars turn green and stick around for two weeks as recent history. Tap a row to open the task.',
  ],
}

export default note
