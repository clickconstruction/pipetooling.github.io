import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5938',
  date: '2026-10-27',
  title: 'The Bridge desks: what the first live look and the mock-ups asked for',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Market and Sales: the asker is the bid’s customer, the way the bid form records a GC, so the book and the chase list read by GC again instead of one “No GC on the bid” row. A bid that became a job or reads started counts as won, as the Sales card counts it, and the estimates’ answer pace has a seven-day floor. Market reads every bid on record for a GC, so dead weight says \u201cno answer, ever\u201d when that is the truth.',
    'Sales: the estimates fade at their own answer pace, the median from sent to accepted over the last year. The row says whether estimates sent the day they were asked are accepted more often, and asks for today’s unsent requests to go out the same day. Every loss with no reason lists under the funnel with a door to its bid, where Why we lost is written.',
    'Bill: the bills marked billed by hand with no send on file list apart, under their own line, and leave the headline. Live, they were a GC’s pay applications, $218k already billed, and the headline summed them as leaks; it now counts only finished work with no bill, the card’s own number. The sitting meter also says how many days of the bank’s cash the pile’s dollar-days are.',
    'Build: a row whose job says one percent while a report before the window read a higher one shows both and says so, instead of reading like the job un-finished.',
  ],
}

export default note
