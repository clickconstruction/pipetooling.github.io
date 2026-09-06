import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2919',
  date: '2026-09-05',
  title: 'Schedule papercuts — honest undo copy, Escape closes Share, Share and Day-email show what will send',
  kind: 'fix',
  highlights: [
    'Schedule → Not coming in: the undo modal now says plainly that clearing the mark only makes the person schedulable again — blocks removed when the day was marked off don\'t come back. The small orange "off" button on an empty cell asks first ("Mark Paige as not coming in?") and tells you no blocks are removed and how to undo.',
    'Share schedule: pressing Escape closes the modal (only the topmost one, so a picker underneath stays open), and the Send now tab lists exactly what the email will contain — every block grouped by person, bid visits included — with a "12 blocks · 5 people · 2 days" headline, or "Nothing scheduled — the email will say so."',
    'Email schedule (Dashboard clock strip): the same "What will send" list for the day and recipient you picked, and Escape closes it.',
    'Calendar: a one-line signpost at the top says dispatch lives on the Schedule hub — this page is your own day plus bid due dates.',
  ],
}

export default note
