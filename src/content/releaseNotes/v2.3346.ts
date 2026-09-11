import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3346',
  date: '2026-09-11',
  title: 'GC statements, both portals, and the payment-terms readers follow "Bills go to"',
  kind: 'feature',
  highlights: [
    'GC Review and the weekly statement list only the bills the GC actually pays. A homeowner-paid job with a GC on it no longer inflates the GC\'s total; those rows sit in a "Not billed to a GC" bucket instead of "No GC set".',
    'A GC\'s portal balance is what the GC owes. Bills on their jobs that went to the owner appear below the ledger as "On your jobs, billed to someone else", with no Pay button and no effect on Total due — and the same the other way round for owners whose builder pays.',
    'A promise made from the portal covers only the jobs that customer owes on.',
    'The payment-terms bar in Edit Job, the "keeps N of M" line under Billed rows, and the payment forecast now describe whoever the bill went to, instead of always the GC.',
  ],
}

export default note
