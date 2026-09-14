import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3403',
  date: '2026-09-14',
  title: 'A job\'s customer and GC are never the same party',
  kind: 'feature',
  highlights: [
    'Pick a builder as the GC on a job and it comes off the customer row; pick it as the customer and it comes off GC. A toast says what moved.',
    'A job with a GC and no customer is a GC job: the Customer row reads "none · GC job", Bills go to offers only the GC, and every bill, statement and portal treats the GC as the payer.',
    'Jobs created from a won bid start as GC jobs (the GC is the GC, not also the customer). GC jobs no longer show up in the "No customer" and "No email" fix-up lists, and lists that name the party show the GC instead of "No customer".',
  ],
}

export default note
