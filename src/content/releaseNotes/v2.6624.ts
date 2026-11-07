import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6624',
  date: '2026-11-07',
  title: 'Lien desk: a sent job with new months due sits in To draft, its reminders riding along',
  kind: 'fix',
  highlights: [
    'A job whose notice went out inside thirty days used to sit in Sent · 30d even when the next months were due, with no draft door, until the sent notice aged out days before the window closed. Months due now win the pile: the row sits in To draft (or Needs the owner) and Sent · 30d keeps only the jobs with nothing due.',
    'The sent facts stay on the row: the row says when the notice went and wears the attorney’s letter chip, and the footer carries the courtesy and attorney’s letter doors above Send for approval, so the next notice drafts while the reminders stay one press away.',
    'Do now shows both the draft row and the reminder row for that job, and the reminder opens the To draft pane. The Dashboard’s draft count now names these jobs too.',
  ],
}

export default note
