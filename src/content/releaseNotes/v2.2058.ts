import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2058',
  date: '2026-08-22',
  kind: 'feature',
  title: 'Add checklist item: scheduling you can actually see',
  highlights: [
    'The add-task form leads with a plain "When" choice — Today, On a date, or Repeats — no more hunting under Advanced to schedule something for next week.',
    'A live green sentence states exactly what Save will do: "Every Mon & Thu on Taunya\'s list, starting Aug 25 — a missed day doesn\'t carry over."',
    'Weekly repeats use tap-able day pills with honest labels (Do on, Starts, Ends); "Stays on the list until done" now only appears where it applies (one-offs).',
    'Notification is one line: notify Me, plus optionally someone else.',
  ],
}

export default note
