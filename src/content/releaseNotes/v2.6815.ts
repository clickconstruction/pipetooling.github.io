import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6815',
  date: '2026-11-09',
  title: 'Take a photo of the supply house ticket at the counter, right in Tally',
  kind: 'feature',
  highlights: [
    'Job Parts Tally has a new blue press under its tabs, Photo of a ticket. The camera opens, then a sheet asks which job the ticket is for. The job you are clocked in on is picked already, so the usual ticket is one photo and one tap.',
    'A PO code the office made for you today comes first on the sheet. Tap a second job for a ticket that covers two, press Another job to search, or press Not for one job for stock and tools. A link under the press takes a receipt the store emailed you.',
    'With no signal the ticket stays on your phone and sends by itself later. My tickets, on the Transactions tab, shows each ticket and where it stands. Open one to change its job, add a page or remove it.',
    'Tickets are filed in the job’s Drive folder under Team only, in Tickets. The office does not see a ticket on its charge yet. That is the next step.',
  ],
}

export default note
