import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2867',
  date: '2026-09-05',
  title: 'Work Orders: every row is a sub sheet, with the rail the sub sees',
  kind: 'feature',
  highlights: [
    'Jobs → Work Orders is now one board of sub sheets: Job · Sub · Agreed · Paid · Open · Where it stands · Next. "Where it stands" is the rail the sub watches on their portal (Work · Inspection · Customer pays · Paid) with the office\'s three steps in front of it (Drafted · Sent · Signed). A dashed red run means work is happening with nothing signed.',
    'The board opens on Working with no agreement — the old amber list is now the first group — then Drafted, Sent, and Signed (collapsed until you open it). Declined and expired offers fall back into the first group as red states with Re-offer ready. Three tiles lead: money on a handshake, offers out, signed this month.',
    'Next names the office\'s move with its button first: Get it in writing, Price it and send, Waiting on the sub (Nudge after three days), Schedule the inspection, Bill and collect, Pay the sub. Sheet › on every row opens the sheet; a signed order\'s WO number opens the record.',
    'A sheet whose job is not in the Pipeline shows a Not in Pipeline tag with Link to a job… (pick the job and the sheet follows it) or New job…. On a phone, rows become cards with the rail on its own line. Crew pay sheets are never listed here.',
  ],
}

export default note
